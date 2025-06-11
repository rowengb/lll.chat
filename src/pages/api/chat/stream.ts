import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getAiClient } from '@/server/ai/client';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import CryptoJS from 'crypto-js';

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Use environment variable for encryption secret
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";

// Helper function for decryption
const decryptApiKey = (encryptedKey: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Helper functions
const getModelProvider = (model?: string) => {
  if (!model) return { provider: "openai", model: "gpt-3.5-turbo" };
  
  if (model.includes("claude") || model.includes("anthropic")) return { provider: "anthropic", model };
  if (model.includes("gemini") || model.includes("google")) return { provider: "gemini", model };
  if (model.includes("deepseek")) return { provider: "deepseek", model };
  if (model.includes("llama") || model.includes("meta")) return { provider: "meta", model };
  return { provider: "openai", model };
};

// Helper to get or create user in Convex
const getOrCreateConvexUser = async (clerkUserId: string) => {
  let user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
  
  if (!user) {
    const newUserId = await convex.mutation(api.users.create, {
      authId: clerkUserId,
      name: undefined,
      email: undefined,
      image: undefined,
    });
    // Fetch the created user
    user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
  }
  
  return user;
};

const getApiKeyFromDatabase = async (userId: Id<"users">, provider: string) => {
  try {
    const apiKey = await convex.query(api.apiKeys.getByUserAndProvider, {
      userId,
      provider,
    });
    
    if (apiKey) {
      return decryptApiKey(apiKey.keyValue);
    }
    return undefined;
  } catch (error) {
    console.error(`Error fetching API key for provider ${provider}:`, error);
    return undefined;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestStart = Date.now();
  console.log(`🚀 [LLL.CHAT] Request started at ${new Date().toISOString()}`);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user authentication
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get or create Convex user
  const convexUser = await getOrCreateConvexUser(auth.userId);

  if (!convexUser) {
    return res.status(500).json({ error: 'Failed to get or create user' });
  }

  const { messages, model = 'gpt-4o' } = req.body;
  console.log(`📝 [LLL.CHAT] Parsed request: model=${model}, messages count=${messages?.length || 0}`);
  
  // Ensure we're using the fastest model
  if (model.includes('gpt-4') && !model.includes('gpt-4o')) {
    console.log(`⚠️  [LLL.CHAT] WARNING: Using slower model ${model} instead of gpt-4o`);
  }
  
  if (messages && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content) {
      console.log(`📝 [LLL.CHAT] Last message content: "${lastMessage.content.substring(0, 50)}..."`);
    }
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    // Determine provider from model
    const modelData = getModelProvider(model);
    
    // Get API key from Convex database
    const apiKey = await getApiKeyFromDatabase(convexUser._id, modelData.provider);
    
    if (!apiKey) {
      console.log(`⚠️  [LLL.CHAT] No API key found for ${modelData.provider}`);
      res.write(`data: ${JSON.stringify({ error: `No API key found for ${modelData.provider}. Please add one in Settings.` })}\n\n`);
      res.end();
      return;
    }

    console.log(`🔑 [LLL.CHAT] Using ${modelData.provider} API key`);
    
    const aiCallStart = Date.now();
    console.log(`🤖 [LLL.CHAT] Starting AI API call at ${new Date().toISOString()}`);

    // Create AI client and stream response
    const aiClient = getAiClient(modelData.provider, apiKey);
    const stream = await aiClient.createChatCompletion({
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      model: model,
      stream: true,
      apiKey,
    });

    const streamReceived = Date.now();
    console.log(`⚡ [LLL.CHAT] AI stream received after ${streamReceived - aiCallStart}ms`);

    let fullResponse = '';
    let chunkCount = 0;
    let firstChunkReceived = false;
    let firstChunkTime = 0;
    let tokenStats = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };
    let streamStartTime = Date.now();

    // Stream the response - handle both old string format and new StreamChunk format
    const isStreamChunk = (chunk: any): chunk is import('@/server/ai/client').StreamChunk => {
      return chunk && typeof chunk === 'object' && 'content' in chunk;
    };

    for await (const chunk of stream as AsyncIterable<any>) {
      const content = isStreamChunk(chunk) ? chunk.content : chunk;
      const tokenUsage = isStreamChunk(chunk) ? chunk.tokenUsage : undefined;
      const isComplete = isStreamChunk(chunk) ? chunk.isComplete : false;

      if (!firstChunkReceived && content) {
        firstChunkTime = Date.now();
        console.log(`🎯 [LLL.CHAT] First content chunk received after ${firstChunkTime - aiCallStart}ms (TTFB: ${firstChunkTime - requestStart}ms)`);
        firstChunkReceived = true;
      }

      if (content) {
        chunkCount++;
        fullResponse += content;

        // Log only first few chunks to avoid performance overhead
        if (chunkCount <= 3) {
          console.log(`📦 [LLL.CHAT] Chunk ${chunkCount}: "${content}" (${content.length} chars)`);
        }

        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }

      // Update token statistics
      if (tokenUsage) {
        tokenStats = tokenUsage;
        const currentTime = Date.now();
        const elapsedSeconds = (currentTime - streamStartTime) / 1000;
        const tokensPerSecond = tokenStats.outputTokens / elapsedSeconds;
        
        console.log(`🔢 [LLL.CHAT] Token update - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}, TPS: ${tokensPerSecond.toFixed(2)}`);
        
        if (isComplete) {
          console.log(`🎯 [LLL.CHAT] FINAL STATS - ${tokensPerSecond.toFixed(2)} tokens/second`);
        }
      }

      // Log completion with final token stats
      if (isComplete && tokenStats.totalTokens > 0) {
        const totalTime = Date.now() - streamStartTime;
        const finalTps = tokenStats.outputTokens / (totalTime / 1000);
        console.log(`✅ [LLL.CHAT] Stream completed with final token stats:`);
        console.log(`📊 [LLL.CHAT] Final tokens - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}`);
        console.log(`🚀 [LLL.CHAT] Final TPS: ${finalTps.toFixed(2)} tokens/second`);
      }
    }
    
    const streamComplete = Date.now();
    console.log(`✅ [LLL.CHAT] Stream completed after ${streamComplete - aiCallStart}ms`);
    console.log(`📊 [LLL.CHAT] Total: ${chunkCount} chunks, ${fullResponse.length} characters`);
    console.log(`⏱️  [LLL.CHAT] Total request time: ${streamComplete - requestStart}ms`);
    
    res.write(`data: [DONE]\n\n`);
    res.end();
    
  } catch (error) {
    console.error('❌ [LLL.CHAT] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
    res.end();
  }
} 