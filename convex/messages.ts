import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    content: v.string(),
    role: v.string(),
    model: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
    attachments: v.optional(v.array(v.id("files"))),
    isGrounded: v.optional(v.boolean()),
    groundingSources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      actualUrl: v.optional(v.string()),
      snippet: v.optional(v.string()),
      confidence: v.optional(v.number()),
    }))),
    groundingSearchQueries: v.optional(v.array(v.string())),
    groundedSegments: v.optional(v.array(v.object({
      text: v.string(),
      confidence: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: args.role,
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
      attachments: args.attachments,
      isGrounded: args.isGrounded,
      groundingSources: args.groundingSources,
      groundingSearchQueries: args.groundingSearchQueries,
      groundedSegments: args.groundedSegments,
    });
  },
});

export const getByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const createMany = mutation({
  args: {
    messages: v.array(v.object({
      content: v.string(),
      role: v.string(),
      model: v.optional(v.string()),
      threadId: v.id("threads"),
      userId: v.id("users"),
      attachments: v.optional(v.array(v.id("files"))),
      isGrounded: v.optional(v.boolean()),
      groundingSources: v.optional(v.array(v.object({
        title: v.string(),
        url: v.string(),
        actualUrl: v.optional(v.string()),
        snippet: v.optional(v.string()),
        confidence: v.optional(v.number()),
      }))),
      groundingSearchQueries: v.optional(v.array(v.string())),
      groundedSegments: v.optional(v.array(v.object({
        text: v.string(),
        confidence: v.number(),
      }))),
    })),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const message of args.messages) {
      const result = await ctx.db.insert("messages", message);
      results.push(result);
    }
    return results;
  },
});

export const createAssistantMessage = mutation({
  args: {
    content: v.string(),
    model: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
    attachments: v.optional(v.array(v.id("files"))),
    isGrounded: v.optional(v.boolean()),
    groundingSources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      actualUrl: v.optional(v.string()),
      snippet: v.optional(v.string()),
      confidence: v.optional(v.number()),
    }))),
    groundingSearchQueries: v.optional(v.array(v.string())),
    groundedSegments: v.optional(v.array(v.object({
      text: v.string(),
      confidence: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: "assistant",
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
      attachments: args.attachments,
      isGrounded: args.isGrounded,
      groundingSources: args.groundingSources,
      groundingSearchQueries: args.groundingSearchQueries,
      groundedSegments: args.groundedSegments,
    });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    // Get the message to check for attachments
    const message = await ctx.db.get(args.messageId);
    if (!message) return null;
    
    // Delete associated files if any
    if (message.attachments && message.attachments.length > 0) {
      for (const fileId of message.attachments) {
        const file = await ctx.db.get(fileId);
        if (file) {
          // Delete from storage
          await ctx.storage.delete(file.storageId);
          // Delete from database
          await ctx.db.delete(fileId);
        }
      }
    }
    
    // Delete the message
    return await ctx.db.delete(args.messageId);
  },
});

// Delete multiple messages from a certain point in a thread
export const deleteMessagesFromPoint = mutation({
  args: { 
    threadId: v.id("threads"), 
    fromMessageId: v.id("messages") 
  },
  handler: async (ctx, args) => {
    // Get all messages in the thread ordered by creation time
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
    
    // Find the index of the fromMessageId
    const fromIndex = messages.findIndex(msg => msg._id === args.fromMessageId);
    if (fromIndex === -1) return { deletedCount: 0 };
    
    // Delete all messages from that point forward
    const messagesToDelete = messages.slice(fromIndex);
    for (const message of messagesToDelete) {
      // Delete associated files if any
      if (message.attachments && message.attachments.length > 0) {
        for (const fileId of message.attachments) {
          const file = await ctx.db.get(fileId);
          if (file) {
            // Delete from storage
            await ctx.storage.delete(file.storageId);
            // Delete from database
            await ctx.db.delete(fileId);
          }
        }
      }
      
      // Delete the message
      await ctx.db.delete(message._id);
    }
    
    return { deletedCount: messagesToDelete.length };
  },
});

export const updateGroundingSourceUnfurl = mutation({
  args: {
    messageId: v.id("messages"),
    sourceIndex: v.number(),
    userId: v.id("users"), // Accept userId directly from TRPC
    unfurledData: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      favicon: v.optional(v.string()),
      siteName: v.optional(v.string()),
      finalUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { messageId, sourceIndex, userId, unfurledData } = args;
    
    // Get the message
    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    
    // Check if user owns this message
    if (message.userId !== userId) {
      throw new Error("Not authorized");
    }
    
    // Update the grounding source with unfurled data
    if (message.groundingSources && message.groundingSources[sourceIndex]) {
      const updatedSources = [...message.groundingSources];
      updatedSources[sourceIndex] = {
        ...updatedSources[sourceIndex],
        unfurledTitle: unfurledData.title,
        unfurledDescription: unfurledData.description,
        unfurledImage: unfurledData.image,
        unfurledFavicon: unfurledData.favicon,
        unfurledSiteName: unfurledData.siteName,
        unfurledFinalUrl: unfurledData.finalUrl,
        unfurledAt: Date.now(),
      };
      
      await ctx.db.patch(messageId, {
        groundingSources: updatedSources,
      });
      
      return { success: true };
    }
    
    return { success: false, error: "Source not found" };
  },
}); 