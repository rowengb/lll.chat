import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create or update user
export const create = mutation({
  args: {
    authId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (existing) {
      // Update existing user
      return await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        image: args.image,
      });
    } else {
      // Create new user
      const userId = await ctx.db.insert("users", args);
      
      // Seed default favorites for the new user  
      const defaultFavorites = await ctx.db
        .query("models")
        .withIndex("by_favorite", (q) => q.eq("isFavorite", true))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      // Insert user's default favorites
      for (const model of defaultFavorites) {
        await ctx.db.insert("userModelFavorites", {
          userId,
          modelId: model.id,
        });
      }
      
      return userId;
    }
  },
});

// Get user by auth ID
export const getByAuthId = query({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

// Update user preferences
export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    defaultModel: v.optional(v.string()),
    titleGenerationModel: v.optional(v.string()),
    useOpenRouter: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    return await ctx.db.patch(userId, updates);
  },
});

// Get user preferences
export const getPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    
    return {
      defaultModel: user.defaultModel,
      titleGenerationModel: user.titleGenerationModel,
      useOpenRouter: user.useOpenRouter,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
}); 