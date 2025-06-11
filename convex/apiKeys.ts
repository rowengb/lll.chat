import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    keyValue: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if key already exists for this user and provider
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();
    
    if (existing) {
      // Update existing key
      return await ctx.db.patch(existing._id, { keyValue: args.keyValue });
    } else {
      // Create new key
      return await ctx.db.insert("apiKeys", {
        userId: args.userId,
        provider: args.provider,
        keyValue: args.keyValue,
      });
    }
  },
});

export const getByUserAndProvider = query({
  args: { userId: v.id("users"), provider: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) => 
        q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const deleteKey = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
}); 