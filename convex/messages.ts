import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    content: v.string(),
    role: v.string(),
    model: v.optional(v.string()),
    threadId: v.id("threads"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      content: args.content,
      role: args.role,
      model: args.model,
      threadId: args.threadId,
      userId: args.userId,
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