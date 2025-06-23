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

// Delete user account and all associated data
export const deleteAccount = mutation({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    // Get the user first
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const userId = user._id;
    
    // Delete all user's threads and their messages
    const userThreads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const thread of userThreads) {
      // Delete all messages in this thread
      const threadMessages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      
      for (const message of threadMessages) {
        await ctx.db.delete(message._id);
      }
      
      // Delete the thread
      await ctx.db.delete(thread._id);
    }
    
    // Delete all user's files
    const userFiles = await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const file of userFiles) {
      // Delete from storage
      try {
        await ctx.storage.delete(file.storageId);
      } catch (error) {
        console.error("Error deleting file from storage:", error);
        // Continue with deletion even if storage deletion fails
      }
      
      // Delete file record
      await ctx.db.delete(file._id);
    }
    
    // Delete all user's API keys
    const userApiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const apiKey of userApiKeys) {
      await ctx.db.delete(apiKey._id);
    }
    
    // Delete all user's model favorites
    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    for (const favorite of userFavorites) {
      await ctx.db.delete(favorite._id);
    }
    
    // Finally, delete the user record
    await ctx.db.delete(userId);
    
    return { success: true, message: "Account and all associated data deleted successfully" };
  },
}); 