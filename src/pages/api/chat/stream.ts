import { NextRequest } from 'next/server';
import { getAuth } from "@clerk/nextjs/server";
import { getAiClient } from '@/server/ai/client';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import CryptoJS from 'crypto-js';
import { debugLog, errorLog, warnLog, forceLog } from '@/utils/logger';

// Force edge runtime to prevent response buffering in production
export const config = {
  runtime: 'edge',
};

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Use environment variable for encryption secret
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";

// Helper function for decryption
const decryptApiKey = (encryptedKey: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const getModelProvider = (model?: string) => {
  if (!model) return { provider: "openai", modelId: "gpt-3.5-turbo" };
  
  if (model.includes("gpt") || model.includes("dall-e")) return { provider: "openai", modelId: model };
  if (model.includes("claude")) return { provider: "anthropic", modelId: model };
  if (model.includes("gemini")) return { provider: "gemini", modelId: model };
  if (model.includes("deepseek")) return { provider: "deepseek", modelId: model };
  if (model.includes("qwen")) return { provider: "openrouter", modelId: model };
  if (model.includes("grok")) return { provider: "xai", modelId: model };
  
  return { provider: "openai", modelId: model };
};

const isImageGenerationModel = (model?: string) => {
  return model?.includes("dall-e");
};

const getOrCreateConvexUser = async (clerkUserId: string) => {
  try {
    let user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
    
    if (!user) {
      await convex.mutation(api.users.create, {
        authId: clerkUserId,
        name: "User", 
        email: "",
        image: "",
      });
      // Fetch the created user
      user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
    }
    
    return user;
  } catch (error) {
    errorLog("Error getting/creating Convex user:", error);
    return null;
  }
};

const getApiKeyFromDatabase = async (userId: Id<"users">, provider: string) => {
  try {
    const apiKey = await convex.query(api.apiKeys.getByUserAndProvider, {
      userId,
      provider,
    });
    
    if (apiKey?.keyValue) {
      return decryptApiKey(apiKey.keyValue);
    }
    
    return null;
  } catch (error) {
    errorLog(`Error getting ${provider} API key:`, error);
    return null;
  }
};

const processFilesForAI = async (files: any[]) => {
  const processedFiles = [];
  
  for (const file of files) {
    try {
      if (file.type?.startsWith('image/')) {
        // Handle image files
        const response = await fetch(file.url);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        processedFiles.push({
          type: 'image_url',
          image_url: {
            url: `data:${file.type};base64,${base64}`,
            detail: 'high'
          }
        });
      } else if (file.type?.startsWith('text/') || file.name?.endsWith('.txt') || file.name?.endsWith('.md')) {
        // Handle text files
        const response = await fetch(file.url);
        const text = await response.text();
        
        processedFiles.push({
          type: 'text',
          text: `File: ${file.name}\n\n${text}`
        });
      }
    } catch (error) {
              errorLog(`Error processing file ${file.name}:`, error);
    }
  }
  
  return processedFiles;
};

const generateContextAwarePrompt = (messages: any[]): string => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.content) {
    return "A beautiful abstract image";
  }
  
  const content = lastMessage.content.toLowerCase();
  
  // If it's a vague request, use conversation context
  if (content.includes("image") || content.includes("picture") || content.includes("draw") || content.includes("create")) {
    // Look for context in previous messages
    for (let i = messages.length - 2; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.content && typeof msg.content === 'string') {
        const subjects = extractVisualSubjects(msg.content);
        if (subjects.length > 0) {
          return `${subjects.join(", ")}, highly detailed, professional quality`;
        }
      }
    }
  }
  
  return lastMessage.content;
};

const extractVisualSubjects = (text: string): string[] => {
  const subjects: string[] = [];
  
  const visualPatterns = [
    /\b(theory of relativity|quantum mechanics|DNA|molecule|atom|solar system|galaxy|black hole)\b/gi,
    /\b(car|house|tree|mountain|ocean|city|building|bridge|flower|animal)\b/gi,
    /\b(love|peace|war|freedom|justice|happiness|sadness|anger|fear)\b/gi,
    /\b(painting|sculpture|architecture|design|pattern|mandala|geometric)\b/gi,
    /\b(landscape|sunset|sunrise|forest|desert|beach|waterfall|volcano)\b/gi,
    /\b(robot|AI|computer|smartphone|rocket|spaceship|laboratory)\b/gi
  ];

  for (const pattern of visualPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      subjects.push(...matches.map(match => match.toLowerCase()));
    }
  }

  return [...new Set(subjects)];
};

export default async function handler(req: NextRequest) {
  const requestStart = Date.now();
  debugLog(`🚀 [LLL.CHAT] Request started at ${new Date().toISOString()}`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get user authentication
  const auth = getAuth(req);
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get or create Convex user
  const convexUser = await getOrCreateConvexUser(auth.userId);

  if (!convexUser) {
    return new Response(JSON.stringify({ error: 'Failed to get or create user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const requestBody = await req.json();
  const { messages, model = 'gpt-4o', threadId, files = [], searchGrounding = true } = requestBody;
  debugLog(`📝 [LLL.CHAT] Parsed request: model=${model}, messages count=${messages?.length || 0}, files count=${files?.length || 0}`);
  
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: 'Messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Create streaming response
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const write = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Get user preferences to check OpenRouter mode
        const userPreferences = await convex.query(api.users.getPreferences, {
          userId: convexUser._id,
        });
        
        // Get model data from database to check for OpenRouter model ID
        const modelFromDb = await convex.query(api.models.getModelById, { modelId: model });
        
        // Determine provider from model
        const modelData = getModelProvider(model);
        
        const useOpenRouterMode = userPreferences?.useOpenRouter ?? false;
        
        let apiKey: string | null = null;
        let actualProvider = modelData.provider;
        let actualModelId = model; // Default to original model ID
        
        if (useOpenRouterMode) {
          // In OpenRouter mode, use OpenRouter API key and model ID
          const openRouterKey = await getApiKeyFromDatabase(convexUser._id, "openrouter");
          if (openRouterKey) {
            apiKey = openRouterKey;
            actualProvider = "openrouter";
            // Use OpenRouter model ID if available, otherwise use original model ID
            if (modelFromDb?.openrouterModelId) {
              actualModelId = modelFromDb.openrouterModelId;
              debugLog(`🔀 [LLL.CHAT] Using OpenRouter mode with model ID: ${actualModelId} (original: ${model})`);
            } else {
              debugLog(`🔀 [LLL.CHAT] Using OpenRouter mode for ${modelData.provider} model: ${model} (no OpenRouter model ID found)`);
            }
          } else {
            warnLog(`⚠️  [LLL.CHAT] OpenRouter mode enabled but no OpenRouter API key found`);
            write(`f:{"error":"OpenRouter mode is enabled but no OpenRouter API key found. Please add an OpenRouter API key in Settings."}\n`);
            controller.close();
            return;
          }
        } else {
          // In individual provider mode, use specific provider API key
          const providerKey = await getApiKeyFromDatabase(convexUser._id, modelData.provider);
          if (providerKey) {
            apiKey = providerKey;
          } else {
            warnLog(`⚠️  [LLL.CHAT] No API key found for ${modelData.provider} in individual provider mode`);
            write(`f:{"error":"No API key found for ${modelData.provider}. Please add a ${modelData.provider} API key in Settings or switch to OpenRouter mode."}\n`);
            controller.close();
            return;
          }
        }

        debugLog(`🔑 [LLL.CHAT] Using ${actualProvider} API key for ${modelData.provider} model (mode: ${useOpenRouterMode ? 'OpenRouter' : 'Individual'})`);
        
        // Add OpenRouter-specific debugging for slow models
        if (actualProvider === "openrouter") {
          debugLog(`🔍 [OPENROUTER-DEBUG] Model: ${actualModelId}, Original: ${model}`);
          debugLog(`🔍 [OPENROUTER-DEBUG] API Key: ...${apiKey.slice(-4)}`);
        }
        
        const aiCallStart = Date.now();
        debugLog(`🤖 [LLL.CHAT] Starting AI API call at ${new Date().toISOString()}`);

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

        debugLog(`🤖 [LLL.CHAT] Sending ${aiMessages.length} messages to AI (${processedFiles.length} files processed)`);

        // Check if this is an image generation request
        if (isImageGenerationModel(model)) {
          debugLog(`🎨 [LLL.CHAT] Image generation request detected for model: ${model}`);
          
          // Generate context-aware prompt from conversation history
          const prompt = generateContextAwarePrompt(messages);
          
          debugLog(`🎨 [LLL.CHAT] Generating image with context-aware prompt: "${prompt}"`);
          
          try {
            // Generate image using OpenAI DALL-E API
            const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                response_format: "url"
              }),
            });

            if (!imageResponse.ok) {
              throw new Error(`Image generation failed: ${imageResponse.status} ${imageResponse.statusText}`);
            }

            const imageData = await imageResponse.json();
            const imageUrl = imageData.data[0]?.url;
            
            if (!imageUrl) {
              throw new Error("No image URL returned from API");
            }

            debugLog(`🎨 [LLL.CHAT] Image generated successfully: ${imageUrl}`);

            // Generate a message ID for this response
            const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Send response
            write(`f:{"messageId":"${messageId}"}\n`);
            write(`f:{"imageGenerated":true,"imageUrl":"${imageUrl}"}\n`);
            write(`d:{"message":""}\n`);
            write(`f:{"finished":true}\n`);
            
            debugLog(`🎨 [LLL.CHAT] Image generation completed in ${Date.now() - aiCallStart}ms`);
            controller.close();
            return;

          } catch (error) {
            errorLog(`❌ [LLL.CHAT] Image generation error:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            write(`f:{"error":"Image generation failed: ${errorMessage}"}\n`);
            controller.close();
            return;
          }
        }

        // Create AI client and stream response for text models
        const aiClient = getAiClient(actualProvider, apiKey);
        
        // Add timeout for OpenRouter requests to detect slow models
        const requestTimeoutMs = actualProvider === "openrouter" ? 30000 : 60000; // 30s for OpenRouter, 60s for others
        const timeoutController = new AbortController();
        const requestTimeout = setTimeout(() => {
          timeoutController.abort();
          warnLog(`⏰ [LLL.CHAT] Request timeout after ${requestTimeoutMs}ms for ${actualProvider}/${actualModelId}`);
        }, requestTimeoutMs);
        
        try {
          const aiStream = await aiClient.createChatCompletion({
            messages: aiMessages,
            model: actualModelId,
            stream: true,
            apiKey,
            enableGrounding: searchGrounding,
          });
          
          clearTimeout(requestTimeout); // Clear timeout since request succeeded

        const streamReceived = Date.now();
        debugLog(`⚡ [LLL.CHAT] AI stream received after ${streamReceived - aiCallStart}ms`);

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
        write(`f:{"messageId":"${messageId}"}\n`);

        // Stream the response - handle both old string format and new StreamChunk format
        const isStreamChunk = (chunk: any): chunk is import('@/server/ai/client').StreamChunk => {
          return chunk && typeof chunk === 'object' && 'content' in chunk;
        };

        let groundingMetadata: any = null;

        for await (const chunk of aiStream as AsyncIterable<any>) {
          const content = isStreamChunk(chunk) ? chunk.content : chunk;
          const tokenUsage = isStreamChunk(chunk) ? chunk.tokenUsage : undefined;
          const isComplete = isStreamChunk(chunk) ? chunk.isComplete : false;
          
          // Check for grounding metadata in the chunk
          if (isStreamChunk(chunk) && chunk.groundingMetadata) {
            groundingMetadata = chunk.groundingMetadata;
            debugLog(`🔍 [LLL.CHAT] Grounding metadata received with ${groundingMetadata.groundingChunks?.length || 0} sources`);
          }

          if (!firstChunkReceived && content) {
            firstChunkTime = Date.now();
            const ttfb = firstChunkTime - aiCallStart;
            const totalTime = firstChunkTime - requestStart;
            debugLog(`🎯 [LLL.CHAT] First content chunk received after ${ttfb}ms (TTFB: ${totalTime}ms)`);
            
            // Warn about slow OpenRouter responses
            if (actualProvider === "openrouter" && ttfb > 5000) {
              warnLog(`⚠️  [OPENROUTER-SLOW] Model ${actualModelId} took ${ttfb}ms for first chunk - this is unusually slow`);
            }
            
            firstChunkReceived = true;
          }

          if (content) {
            chunkCount++;
            fullResponse += content;

            // Log only first chunk to avoid performance overhead
            if (chunkCount === 1) {
              debugLog(`📦 [LLL.CHAT] First chunk: "${content}" (${content.length} chars)`);
            }

            // Send content in T3.chat format: 0:"content"
            write(`0:${JSON.stringify(content)}\n`);
          }

          // Update token statistics (only log final stats to avoid performance overhead)
          if (tokenUsage) {
            tokenStats = tokenUsage;
            
            if (isComplete) {
              const currentTime = Date.now();
              const elapsedSeconds = (currentTime - streamStartTime) / 1000;
              const tokensPerSecond = tokenStats.outputTokens / elapsedSeconds;
              debugLog(`🎯 [LLL.CHAT] FINAL STATS - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}, TPS: ${tokensPerSecond.toFixed(2)}`);
            }
          }

          // Log completion with final token stats
          if (isComplete && tokenStats.totalTokens > 0) {
            const totalTime = Date.now() - streamStartTime;
            const finalTps = tokenStats.outputTokens / (totalTime / 1000);
            debugLog(`✅ [LLL.CHAT] Stream completed with final token stats:`);
            debugLog(`📊 [LLL.CHAT] Final tokens - Input: ${tokenStats.inputTokens}, Output: ${tokenStats.outputTokens}, Total: ${tokenStats.totalTokens}`);
            debugLog(`🚀 [LLL.CHAT] Final TPS: ${finalTps.toFixed(2)} tokens/second`);
          }
        }
        
        const streamComplete = Date.now();
        debugLog(`✅ [LLL.CHAT] Stream completed after ${streamComplete - aiCallStart}ms`);
        debugLog(`📊 [LLL.CHAT] Total: ${chunkCount} chunks, ${fullResponse.length} characters`);
        debugLog(`⏱️  [LLL.CHAT] Total request time: ${streamComplete - requestStart}ms`);
        
        // Send grounding metadata if available
        if (groundingMetadata) {
          debugLog(`🔗 [LLL.CHAT] Sending grounding metadata with response`);
          write(`f:{"grounding":${JSON.stringify(groundingMetadata)}}\n`);
        }
        
        // Send completion signal (T3.chat style) - don't include full content to avoid parsing issues
        write(`d:{"type":"done","length":${fullResponse.length}}\n`);
        
        } catch (timeoutError: any) {
          clearTimeout(requestTimeout);
          if (timeoutError.name === 'AbortError') {
            warnLog(`⏰ [LLL.CHAT] Request aborted due to timeout for ${actualProvider}/${actualModelId}`);
            write(`f:{"error":"Request timeout - the model is taking too long to respond. Try a different model or try again later."}\n`);
          } else {
            throw timeoutError; // Re-throw other errors
          }
        }
        
      } catch (error) {
        errorLog('❌ [LLL.CHAT] Streaming error:', error);
        
        // Provide specific error messages based on the error type
        let errorMessage = "Failed to generate response";
        
        if (error instanceof Error) {
          if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
            errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
          } else if (error.message.includes('API key')) {
            errorMessage = "Invalid API key. Please check your API key in Settings.";
          } else if (error.message.includes('quota') || error.message.includes('billing')) {
            errorMessage = "API quota exceeded or billing issue. Please check your account.";
          } else if (error.message.includes('network') || error.message.includes('timeout')) {
            errorMessage = "Network error. Please check your connection and try again.";
          }
        }
        
        write(`f:{"error":"${errorMessage}"}\n`);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}