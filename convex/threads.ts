import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.optional(v.string()),
    lastModel: v.optional(v.string()),
    branchedFromThreadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("threads", {
      userId: args.userId,
      title: args.title,
      lastModel: args.lastModel,
      pinned: false,
      branchedFromThreadId: args.branchedFromThreadId,
    });
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("threads"),
    title: v.optional(v.string()),
    lastModel: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

// Generate AI-powered title for a thread based on the first user message
export const generateTitle = action({
  args: {
    threadId: v.id("threads"),
    firstMessage: v.string(),
    apiKey: v.string(),
    modelId: v.optional(v.string()), // Optional model ID, defaults to gpt-4o-mini
    provider: v.optional(v.string()), // Optional provider, defaults to openai
  },
  handler: async (ctx, args) => {
    try {
      const modelId = args.modelId || "gpt-4o-mini"; // Default fallback
      const provider = args.provider || "openai"; // Default to OpenAI
      
      // Determine the API endpoint and request format based on provider
      let apiUrl: string;
      let headers: Record<string, string>;
      let requestBody: any;
      
      const systemMessage = "Generate a concise, descriptive title (max 60 characters) for a chat conversation based on the user's first message. The title should capture the main topic or intent. Respond with only the title, no quotes or extra formatting.";
      
      switch (provider) {
        case "openai":
          apiUrl = "https://api.openai.com/v1/chat/completions";
          headers = {
            "Authorization": `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
          };
          requestBody = {
            model: modelId,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: args.firstMessage }
            ],
            max_completion_tokens: 350,
          };
          // Only add temperature for models that support it (exclude o1 series and reasoning models)
          if (!modelId.startsWith("o1") && !modelId.includes("reasoning")) {
            requestBody.temperature = 1.0;
          }
          break;
          
        case "anthropic":
          apiUrl = "https://api.anthropic.com/v1/messages";
          headers = {
            "x-api-key": args.apiKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          };
          requestBody = {
            model: modelId,
            max_tokens: 20,
            messages: [
              { role: "user", content: `${systemMessage}\n\nUser message: ${args.firstMessage}` }
            ],
          };
          break;
          
        case "gemini":
          apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
          headers = {
            "Content-Type": "application/json",
          };
          requestBody = {
            contents: [{
              parts: [{
                text: `${systemMessage}\n\nUser message: ${args.firstMessage}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: 20,
            }
          };
          // Add API key as query parameter for Gemini
          apiUrl += `?key=${args.apiKey}`;
          break;
          
        case "openrouter":
          apiUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers = {
            "Authorization": `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lll.chat",
            "X-Title": "lll.chat",
          };
          requestBody = {
            model: modelId,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: args.firstMessage }
            ],
            max_tokens: 350,
          };
          // Only add temperature for models that support it (exclude o1 series and reasoning models)
          if (!modelId.startsWith("o1") && !modelId.includes("reasoning")) {
            requestBody.temperature = 1.0;
          }
          break;
          
        case "xai":
          apiUrl = "https://api.x.ai/v1/chat/completions";
          headers = {
            "Authorization": `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
          };
          requestBody = {
            model: modelId,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: args.firstMessage }
            ],
            max_tokens: 350,
            temperature: 1.0,
          };
          break;
          
        default:
          // For other providers, try OpenAI-compatible format
          apiUrl = "https://api.openai.com/v1/chat/completions";
          headers = {
            "Authorization": `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
          };
          requestBody = {
            model: modelId,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: args.firstMessage }
            ],
            max_completion_tokens: 350,
          };
          // Only add temperature for models that support it (exclude o1 series and reasoning models)
          if (!modelId.startsWith("o1") && !modelId.includes("reasoning")) {
            requestBody.temperature = 1.0;
          }
          break;
      }
      
      // Generate a concise title using the appropriate API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${provider.toUpperCase()} API error:`, errorText);
        return { success: false, error: `Failed to generate title using ${provider}` };
      }

      const data = await response.json();
      console.log(`${provider.toUpperCase()} API response:`, JSON.stringify(data, null, 2));
      let generatedTitle: string | undefined;
      
      // Extract title based on provider response format
      switch (provider) {
        case "anthropic":
          generatedTitle = data.content?.[0]?.text?.trim();
          break;
        case "gemini":
          generatedTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          break;
        default:
          // OpenAI, OpenRouter, and other OpenAI-compatible providers
          generatedTitle = data.choices?.[0]?.message?.content?.trim();
          break;
      }

      console.log(`${provider.toUpperCase()} extracted title:`, generatedTitle);

      if (!generatedTitle) {
        console.log(`${provider.toUpperCase()} failed to extract title from response:`, data);
        return { success: false, error: "No title generated" };
      }

      // Store the full title (no truncation in database)
      const title = generatedTitle;

      // Update the thread with the generated title
      await ctx.runMutation(api.threads.update, { id: args.threadId, title });

      return { success: true, title };
    } catch (error) {
      console.error("Error generating title:", error);
      return { success: false, error: "Failed to generate title" };
    }
  },
});

export const deleteThread = mutation({
  args: { id: v.id("threads"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // First get all files associated with this thread
    const threadFiles = await ctx.db
      .query("files")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect();
    
    // Delete all files from storage and database
    for (const file of threadFiles) {
      // Delete from storage
      await ctx.storage.delete(file.storageId);
      // Delete from database
      await ctx.db.delete(file._id);
    }
    
    // Then delete all messages in this thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Finally delete the thread
    return await ctx.db.delete(args.id);
  },
}); 