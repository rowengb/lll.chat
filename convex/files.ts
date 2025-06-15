import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createFile = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    userId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", {
      name: args.name,
      type: args.type,
      size: args.size,
      storageId: args.storageId,
      userId: args.userId,
      messageId: args.messageId,
      threadId: args.threadId,
    });
  },
});



export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) return null;

    const url = await ctx.storage.getUrl(file.storageId);
    return {
      ...file,
      url,
    };
  },
});

export const getFilesByMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const url = await ctx.storage.getUrl(file.storageId);
        return {
          ...file,
          url,
        };
      })
    );

    return filesWithUrls;
  },
});

export const getFilesByThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const url = await ctx.storage.getUrl(file.storageId);
        return {
          ...file,
          url,
        };
      })
    );

    return filesWithUrls;
  },
});

export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) return null;

    // Delete from storage
    await ctx.storage.delete(file.storageId);
    
    // Delete from database
    await ctx.db.delete(args.fileId);
    
    return { success: true };
  },
});

export const getFilesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const url = await ctx.storage.getUrl(file.storageId);
        return {
          ...file,
          url,
        };
      })
    );

    return filesWithUrls;
  },
});

export const updateFileAssociations = mutation({
  args: {
    fileIds: v.array(v.id("files")),
    messageId: v.id("messages"),
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Update all files to associate them with the message and thread
    for (const fileId of args.fileIds) {
      await ctx.db.patch(fileId, {
        messageId: args.messageId,
        threadId: args.threadId,
      });
    }
    return { success: true };
  },
}); 