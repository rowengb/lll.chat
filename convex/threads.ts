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
  },
  handler: async (ctx, args) => {
    try {
      // Use OpenAI to generate a concise title
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Fast and cost-effective for this task
          messages: [
            {
              role: "system",
              content: "Generate a concise, descriptive title (max 60 characters) for a chat conversation based on the user's first message. The title should capture the main topic or intent. Respond with only the title, no quotes or extra formatting."
            },
            {
              role: "user",
              content: args.firstMessage
            }
          ],
          max_tokens: 20,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error("OpenAI API error:", await response.text());
        return { success: false, error: "Failed to generate title" };
      }

      const data = await response.json();
      const generatedTitle = data.choices[0]?.message?.content?.trim();

      if (!generatedTitle) {
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