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

// Helper function to process files for AI models
const processFilesForAI = async (files: any[]) => {
  const processedFiles = [];
  
  for (const file of files) {
    try {
      // Get the file data with URL from Convex
      let fileWithUrl = file;
      if (file.id && !file.url) {
        // If we have a file ID but no URL, fetch from Convex
        fileWithUrl = await convex.query(api.files.getFile, { fileId: file.id });
        if (!fileWithUrl) {
          throw new Error(`File not found: ${file.id}`);
        }
      }
      
      if (!fileWithUrl.url) {
        console.warn(`⚠️ [LLL.CHAT] No URL available for file ${file.name}, skipping processing`);
        processedFiles.push({
          type: 'text',
          text: `[File attached: ${file.name} (${file.type}, ${formatFileSize(file.size)}) - preview not available]`
        });
        continue;
      }
      
      if (fileWithUrl.type.startsWith('image/')) {
        // For images, fetch the file and convert to base64
        const response = await fetch(fileWithUrl.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        processedFiles.push({
          type: 'image_url',
          image_url: {
            url: `data:${fileWithUrl.type};base64,${base64}`,
            detail: 'auto'
          }
        });
        
        console.log(`📷 [LLL.CHAT] Processed image: ${fileWithUrl.name} (${fileWithUrl.type})`);
      } else if (fileWithUrl.type === 'text/plain' || fileWithUrl.type.includes('text/')) {
        // For text files, fetch content and include as text
        const response = await fetch(fileWithUrl.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        const textContent = await response.text();
        
        processedFiles.push({
          type: 'text',
          text: `File: ${fileWithUrl.name}\n\n${textContent}`
        });
        
        console.log(`📄 [LLL.CHAT] Processed text file: ${fileWithUrl.name}`);
      } else {
        // For other file types, just mention the file
        processedFiles.push({
          type: 'text',
          text: `[File attached: ${fileWithUrl.name} (${fileWithUrl.type}, ${formatFileSize(fileWithUrl.size)})]`
        });
        
        console.log(`📎 [LLL.CHAT] Referenced file: ${fileWithUrl.name} (${fileWithUrl.type})`);
      }
    } catch (error) {
      console.error(`❌ [LLL.CHAT] Error processing file ${file.name}:`, error);
      // Add a fallback reference
      processedFiles.push({
        type: 'text',
        text: `[File: ${file.name} - could not process]`
      });
    }
  }
  
  return processedFiles;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const { messages, model = 'gpt-4o', threadId, files = [], searchGrounding = true } = req.body;
  console.log(`📝 [LLL.CHAT] Parsed request: model=${model}, messages count=${messages?.length || 0}, files count=${files?.length || 0}`);
  
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

  if (files && files.length > 0) {
    console.log(`📎 [LLL.CHAT] Processing ${files.length} file(s)`);
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Set headers for Server-Sent Events (T3.chat style)
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
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
      res.write(`f:{"error":"No API key found for ${modelData.provider}. Please add one in Settings."}\n`);
      res.end();
      return;
    }

    console.log(`🔑 [LLL.CHAT] Using ${modelData.provider} API key`);
    
    const aiCallStart = Date.now();
    console.log(`🤖 [LLL.CHAT] Starting AI API call at ${new Date().toISOString()}`);

    // Process files if any are provided
    let processedFiles: any[] = [];
    if (files && files.length > 0) {
      processedFiles = await processFilesForAI(files);
    }

    // Prepare messages for AI, including files in the last user message if present
    const aiMessages = messages.map((m: any, index: number) => {
      // If this is the last message and it's from the user, and we have files, include them
      if (index === messages.length - 1 && m.role === 'user' && processedFiles.length > 0) {
        const content = [];
        
        // Add text content if present
        if (m.content && m.content.trim()) {
          content.push({
            type: 'text',
            text: m.content
          });
        }
        
        // Add processed files
        content.push(...processedFiles);
        
        return {
          role: m.role,
          content: content
        };
      }
      
      // For other messages, use simple text format
      return {
        role: m.role,
        content: m.content
      };
    });

    console.log(`🤖 [LLL.CHAT] Sending ${aiMessages.length} messages to AI (${processedFiles.length} files processed)`);

    // Create AI client and stream response
    const aiClient = getAiClient(modelData.provider, apiKey);
    const stream = await aiClient.createChatCompletion({
      messages: aiMessages,
      model: model,
      stream: true,
      apiKey,
      enableGrounding: searchGrounding,
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

    // Generate a message ID for this response
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send initial metadata (T3.chat style)
    res.write(`f:{"messageId":"${messageId}"}\n`);

    // Stream the response - handle both old string format and new StreamChunk format
    const isStreamChunk = (chunk: any): chunk is import('@/server/ai/client').StreamChunk => {
      return chunk && typeof chunk === 'object' && 'content' in chunk;
    };

    let groundingMetadata: any = null;

    for await (const chunk of stream as AsyncIterable<any>) {
      const content = isStreamChunk(chunk) ? chunk.content : chunk;
      const tokenUsage = isStreamChunk(chunk) ? chunk.tokenUsage : undefined;
      const isComplete = isStreamChunk(chunk) ? chunk.isComplete : false;
      
      // Check for grounding metadata in the chunk
      if (isStreamChunk(chunk) && chunk.groundingMetadata) {
        groundingMetadata = chunk.groundingMetadata;
        console.log(`🔍 [LLL.CHAT] Grounding metadata received with ${groundingMetadata.groundingChunks?.length || 0} sources`);
      }

      if (!firstChunkReceived && content) {
        firstChunkTime = Date.now();
        console.log(`🎯 [LLL.CHAT] First content chunk received after ${firstChunkTime - aiCallStart}ms (TTFB: ${firstChunkTime - requestStart}ms)`);
        firstChunkReceived = true;
      }

      if (content) {
        chunkCount++;
        fullResponse += content;

        // Log only first chunk to avoid performance overhead
        if (chunkCount === 1) {
          console.log(`📦 [LLL.CHAT] First chunk: "${content}" (${content.length} chars)`);
        }

        // Send content in T3.chat format: 0:"content"
        res.write(`0:${JSON.stringify(content)}\n`);
      }

      // Update token statistics (only log final stats to avoid performance overhead)
      if (tokenUsage) {
        tokenStats = tokenUsage;
        
        if (isComplete) {
          const currentTime = Date.now();
          const elapsedSeconds = (currentTime - streamStartTime) / 1000;
          const tokensPerSecond = tokenStats.outputTokens / elapsedSeconds;
          console.log(`🎯 [LLL.CHAT] FINAL STATS - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}, TPS: ${tokensPerSecond.toFixed(2)}`);
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
    
    // Send grounding metadata if available
    if (groundingMetadata) {
      console.log(`🔗 [LLL.CHAT] Sending grounding metadata with response`);
      res.write(`f:{"grounding":${JSON.stringify(groundingMetadata)}}\n`);
    }
    
    // Send completion signal (T3.chat style) - don't include full content to avoid parsing issues
    res.write(`d:{"type":"done","length":${fullResponse.length}}\n`);
    res.end();
    
  } catch (error) {
    console.error('❌ [LLL.CHAT] Streaming error:', error);
    
    // Provide specific error messages based on the error type
    let errorMessage = "Failed to generate response";
    
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes('API key')) {
        errorMessage = "Invalid API key. Please check your API key in Settings.";
      } else if (error.message.includes('Gemini API failed after')) {
        errorMessage = "Gemini API is currently unavailable. Please try again later or switch to a different model.";
      } else if (error.message.includes('quota') || error.message.includes('billing')) {
        errorMessage = "API quota exceeded or billing issue. Please check your account.";
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
    }
    
    res.write(`f:{"error":"${errorMessage}"}\n`);
    res.end();
  }
} 