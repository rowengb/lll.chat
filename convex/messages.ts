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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: args.role,
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
      attachments: args.attachments,
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: "assistant",
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
      attachments: args.attachments,
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