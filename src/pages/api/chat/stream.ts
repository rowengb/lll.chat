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
  if (model.includes("grok") || model.includes("xai")) return { provider: "xai", model };
  return { provider: "openai", model };
};

// Check if a model is for image generation
const isImageGenerationModel = (model?: string) => {
  if (!model) return false;
  return model.includes("image") || model.includes("dall-e") || model === "gpt-image-1";
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

// Generate context-aware prompt for image generation
const generateContextAwarePrompt = (messages: any[]): string => {
  if (!messages || messages.length === 0) {
    return "A beautiful image";
  }

  const lastMessage = messages[messages.length - 1];
  const lastUserPrompt = (lastMessage?.content as string) || "";

  // Clean up the prompt by removing common prefixes but keep the core request
  let cleanedPrompt = lastUserPrompt.trim();
  
  // Remove common image generation prefixes
  cleanedPrompt = cleanedPrompt.replace(/^(generate an image of|create an image of|make an image of|draw|genereate an image of)\s*/i, "");
  
  // Check if this is a modification request that should reference a previous image
  if (isImageModificationRequest(cleanedPrompt)) {
    const previousImagePrompt = findPreviousImagePrompt(messages);
    if (previousImagePrompt) {
      return combineImagePrompts(previousImagePrompt, cleanedPrompt);
    }
  }
  
  // If we have a meaningful prompt after cleanup, use it directly
  if (cleanedPrompt.length >= 5) {
    return cleanedPrompt;
  }

  // Only use context-aware logic for truly vague requests (very short or only generic words)
  if (isVagueImageRequest(lastUserPrompt)) {
    // Look for context in recent conversation (last 5 messages)
    const recentMessages = messages.slice(-5);
    
    // Extract key topics from recent conversation
    for (let i = recentMessages.length - 2; i >= 0; i--) {
      const message = recentMessages[i];
      if (message?.content && typeof message.content === 'string') {
        const content = message.content.toLowerCase();
        
        // Look for specific subjects that could be visualized
        const subjects = extractVisualSubjects(content);
        if (subjects.length > 0) {
          const mainSubject = subjects[0];
          return `A detailed visual representation of ${mainSubject}, high quality, professional illustration`;
        }
      }
    }
  }

  // Final fallback - use the original prompt or a generic fallback
  return lastUserPrompt || "A beautiful, artistic image";
};

// Helper function to check if text is a truly vague image request
const isVagueImageRequest = (text: string): boolean => {
  const trimmed = text.trim().toLowerCase();
  
  // Very short requests (less than 5 characters) are likely vague
  if (trimmed.length < 5) {
    return true;
  }
  
  // Exact matches for completely generic requests
  const vagueExactMatches = [
    "image",
    "picture", 
    "photo",
    "generate image",
    "create image",
    "make image",
    "draw something",
    "show me",
    "give me"
  ];
  
  if (vagueExactMatches.includes(trimmed)) {
    return true;
  }
  
  // Only treat as vague if it's ONLY generic words with no specific content
  const genericOnlyPattern = /^(generate|create|make|draw|show me|give me)\s*(an?\s*)?(image|picture|photo)\s*$/i;
  
  return genericOnlyPattern.test(trimmed);
};

// Helper function to detect if a prompt is trying to modify a previous image
const isImageModificationRequest = (text: string): boolean => {
  const trimmed = text.trim().toLowerCase();
  
  // Patterns that indicate modification of existing content
  const modificationPatterns = [
    /^make (it|this|that)\s+/i,
    /^turn (it|this|that) into\s+/i,
    /^convert (it|this|that) to\s+/i,
    /^change (it|this|that) to\s+/i,
    /^style (it|this|that) as\s+/i,
    /^render (it|this|that) as\s+/i,
    /^but /i,
    /^now /i,
    /^also /i,
    /^add /i,
    /^remove /i,
    /^with /i,
    /^in the style of/i
  ];
  
  return modificationPatterns.some(pattern => pattern.test(trimmed));
};

// Helper function to find the most recent image generation prompt in the conversation
const findPreviousImagePrompt = (messages: any[]): string | null => {
  // Look backwards through messages to find the most recent image generation
  for (let i = messages.length - 2; i >= 0; i--) {
    const message = messages[i];
    if (message?.content && typeof message.content === 'string') {
      // Check if this was likely an image generation request
      const content = message.content.trim();
      
      // Skip very short or vague requests
      if (content.length < 5 || isVagueImageRequest(content)) {
        continue;
      }
      
      // If it contains image generation keywords or was long enough to be descriptive
      const hasImageKeywords = /\b(image|picture|photo|generate|create|draw|show|paint|render|visualize)\b/i.test(content);
      const isDescriptive = content.length >= 10;
      
      if (hasImageKeywords || isDescriptive) {
        // Clean the prompt
        let cleanedPrompt = content.replace(/^(generate an image of|create an image of|make an image of|draw|genereate an image of)\s*/i, "");
        return cleanedPrompt.trim();
      }
    }
  }
  
  return null;
};

// Helper function to combine previous image prompt with modification request
const combineImagePrompts = (previousPrompt: string, modification: string): string => {
  const mod = modification.trim().toLowerCase();
  
  // Handle different types of modifications
  if (mod.startsWith('make it') || mod.startsWith('make this') || mod.startsWith('make that')) {
    const modificationPart = mod.replace(/^make (it|this|that)\s+/i, '').trim();
    if (modificationPart.startsWith('into')) {
      // "make it into a painting" -> "city in dubai as a painting"
      const style = modificationPart.replace(/^into\s+(a\s+|an\s+)?/i, '').trim();
      return `${previousPrompt} rendered as ${style}`;
    } else if (modificationPart.startsWith('more')) {
      // "make it more colorful" -> "city in dubai, more colorful"
      return `${previousPrompt}, ${modificationPart}`;
    } else {
      // "make it red" -> "city in dubai, but red"
      return `${previousPrompt}, but ${modificationPart}`;
    }
  }
  
  if (mod.startsWith('turn it into') || mod.startsWith('convert it to')) {
    const style = mod.replace(/^(turn it into|convert it to)\s+(a\s+|an\s+)?/i, '').trim();
    return `${previousPrompt} styled as ${style}`;
  }
  
  if (mod.startsWith('in the style of')) {
    return `${previousPrompt} ${modification}`;
  }
  
  if (mod.startsWith('but') || mod.startsWith('with')) {
    return `${previousPrompt} ${modification}`;
  }
  
  if (mod.startsWith('add') || mod.startsWith('remove')) {
    return `${previousPrompt}, ${modification}`;
  }
  
  // Default combination
  return `${previousPrompt} with ${modification}`;
};

// Helper function to extract visual subjects from text
const extractVisualSubjects = (text: string): string[] => {
  const subjects: string[] = [];
  
  // Look for specific topics that can be visualized
  const visualPatterns = [
    // Scientific concepts
    /\b(theory of relativity|quantum mechanics|DNA|molecule|atom|solar system|galaxy|black hole)\b/gi,
    // Objects and things
    /\b(car|house|tree|mountain|ocean|city|building|bridge|flower|animal)\b/gi,
    // Abstract concepts that can be visualized
    /\b(love|peace|war|freedom|justice|happiness|sadness|anger|fear)\b/gi,
    // Art and design
    /\b(painting|sculpture|architecture|design|pattern|mandala|geometric)\b/gi,
    // Nature
    /\b(landscape|sunset|sunrise|forest|desert|beach|waterfall|volcano)\b/gi,
    // Technology
    /\b(robot|AI|computer|smartphone|rocket|spaceship|laboratory)\b/gi
  ];

  for (const pattern of visualPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      subjects.push(...matches.map(match => match.toLowerCase()));
    }
  }

  // Remove duplicates and return
  return [...new Set(subjects)];
};

// Helper function to extract fallback context from messages
const extractFallbackContext = (messages: any[]): string | null => {
  for (let i = messages.length - 2; i >= 0; i--) {
    const message = messages[i];
    if (message?.content && typeof message.content === 'string') {
      const content = message.content;
      
      // Look for any noun phrases that could be visualized
      const nounPhrases = content.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*\b/g);
      if (nounPhrases && nounPhrases.length > 0) {
        return nounPhrases[0];
      }
      
      // Look for any capitalized words (potential proper nouns)
      const capitalizedWords = content.match(/\b[A-Z][a-z]+\b/g);
      if (capitalizedWords && capitalizedWords.length > 0) {
        return capitalizedWords[0];
      }
    }
  }
  
  return null;
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
          console.log(`🔀 [LLL.CHAT] Using OpenRouter mode with model ID: ${actualModelId} (original: ${model})`);
        } else {
          console.log(`🔀 [LLL.CHAT] Using OpenRouter mode for ${modelData.provider} model: ${model} (no OpenRouter model ID found)`);
        }
      } else {
        console.log(`⚠️  [LLL.CHAT] OpenRouter mode enabled but no OpenRouter API key found`);
        res.write(`f:{"error":"OpenRouter mode is enabled but no OpenRouter API key found. Please add an OpenRouter API key in Settings."}\n`);
        res.end();
        return;
      }
    } else {
      // In individual provider mode, use specific provider API key
      const providerKey = await getApiKeyFromDatabase(convexUser._id, modelData.provider);
      if (providerKey) {
        apiKey = providerKey;
      } else {
        console.log(`⚠️  [LLL.CHAT] No API key found for ${modelData.provider} in individual provider mode`);
        res.write(`f:{"error":"No API key found for ${modelData.provider}. Please add a ${modelData.provider} API key in Settings or switch to OpenRouter mode."}\n`);
        res.end();
        return;
      }
    }

    console.log(`🔑 [LLL.CHAT] Using ${actualProvider} API key for ${modelData.provider} model (mode: ${useOpenRouterMode ? 'OpenRouter' : 'Individual'})`);
    
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

    // Check if this is an image generation request
    if (isImageGenerationModel(model)) {
      console.log(`🎨 [LLL.CHAT] Image generation request detected for model: ${model}`);
      
      // Generate context-aware prompt from conversation history
      const prompt = generateContextAwarePrompt(messages);
      
      console.log(`🎨 [LLL.CHAT] Generating image with context-aware prompt: "${prompt}"`);
      
      // Validate prompt
      if (!prompt || prompt.trim().length === 0) {
        throw new Error("Empty prompt provided for image generation");
      }
      
      if (prompt.length > 4000) {
        throw new Error(`Prompt too long (${prompt.length} characters). DALL-E 3 supports up to 4000 characters.`);
      }
      
      console.log(`🎨 [LLL.CHAT] Prompt validation passed. Length: ${prompt.length} characters`);
      console.log(`🔑 [LLL.CHAT] Using API key ending in: ...${apiKey.slice(-4)}`);
      
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
          // Get detailed error information from the response
          let errorDetails = '';
          try {
            const errorData = await imageResponse.json();
            errorDetails = JSON.stringify(errorData, null, 2);
            console.error(`❌ [LLL.CHAT] DALL-E API Error Details:`, errorData);
          } catch (parseError) {
            const errorText = await imageResponse.text();
            errorDetails = errorText;
            console.error(`❌ [LLL.CHAT] DALL-E API Error Text:`, errorText);
          }
          
          throw new Error(`Image generation failed: ${imageResponse.status} ${imageResponse.statusText}. Details: ${errorDetails}`);
        }

        const imageData = await imageResponse.json();
        const imageUrl = imageData.data[0]?.url;
        
        if (!imageUrl) {
          throw new Error("No image URL returned from API");
        }

        console.log(`🎨 [LLL.CHAT] Image generated successfully: ${imageUrl}`);
        console.log(`💾 [LLL.CHAT] Now saving image to Convex storage immediately...`);

        // Save image to Convex storage immediately before responding
        try {
          // Download the image from DALL-E
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }

          const imageBlob = await response.blob();
          
          // Generate upload URL
          const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
          
          // Upload the image to Convex storage
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'image/png',
            },
            body: imageBlob,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
          }

          const { storageId } = await uploadResponse.json();

          // Create file record
          const fileName = `generated-image-${Date.now()}.png`;
          const fileId = await convex.mutation(api.files.createFile, {
            name: fileName,
            type: 'image/png',
            size: imageBlob.size,
            storageId: storageId,
            userId: convexUser._id,
            threadId: threadId,
          });

          // Get the Convex URL for the stored image
          const storedImageFile = await convex.query(api.files.getFile, { fileId });
          const convexImageUrl = storedImageFile?.url;

          if (!convexImageUrl) {
            throw new Error("Failed to get Convex image URL");
          }

          console.log(`✅ [LLL.CHAT] Image saved to Convex storage with URL: ${convexImageUrl}`);

          // Generate a message ID for this response
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Send the Convex image URL instead of the temporary DALL-E URL
          res.write(`f:{"messageId":"${messageId}"}\n`);
          res.write(`f:{"imageGenerated":true,"imageUrl":"${convexImageUrl}"}\n`);
          res.write(`d:{"message":""}\n`);
          res.write(`f:{"finished":true}\n`);
          res.end();
          
          console.log(`🎨 [LLL.CHAT] Image generation and storage completed in ${Date.now() - aiCallStart}ms`);
          return;

        } catch (storageError) {
          console.error(`❌ [LLL.CHAT] Failed to save image to Convex storage:`, storageError);
          
          // Fallback to temporary URL if storage fails
          console.log(`⚠️ [LLL.CHAT] Falling back to temporary DALL-E URL`);
          
          // Generate a message ID for this response
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Send the temporary image URL as fallback
          res.write(`f:{"messageId":"${messageId}"}\n`);
          res.write(`f:{"imageGenerated":true,"imageUrl":"${imageUrl}"}\n`);
          res.write(`d:{"message":""}\n`);
          res.write(`f:{"finished":true}\n`);
          res.end();
          
          console.log(`🎨 [LLL.CHAT] Image generation completed with fallback in ${Date.now() - aiCallStart}ms`);
          return;
        }
        
      } catch (error) {
        console.error(`❌ [LLL.CHAT] Image generation error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        res.write(`f:{"error":"Image generation failed: ${errorMessage}"}\n`);
        res.end();
        return;
      }
    }

    // Create AI client and stream response for text models
    const aiClient = getAiClient(actualProvider, apiKey);
    const stream = await aiClient.createChatCompletion({
      messages: aiMessages,
      model: actualModelId,
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