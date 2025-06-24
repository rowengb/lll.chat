import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create or update user
export const create = mutation({
  args: {
    authId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.optional(v.number()),
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
        createdAt: args.createdAt,
      });
    } else {
      // Create new user with default subscription fields
      const userId = await ctx.db.insert("users", {
        ...args,
        createdAt: args.createdAt || Date.now(), // Use provided createdAt or current timestamp
        isPaidUser: false, // Default to free user
        subStatus: undefined,
        subPlan: undefined,
        subDate: undefined,
        subEndDate: undefined,
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
      });
      
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

// Check if user is paid (has active subscription)
export const isPaidUser = query({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) return false;
    
    // Check if user has active subscription
    if (!user.isPaidUser) return false;
    
    // Check if subscription is still valid (not expired)
    if (user.subEndDate && user.subEndDate < Date.now()) {
      return false;
    }
    
    // Check subscription status
    return user.subStatus === "active" || user.subStatus === "trialing";
  },
});

// Get subscription information
export const getSubscription = query({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) return null;
    
    return {
      isPaidUser: user.isPaidUser || false,
      subStatus: user.subStatus,
      subPlan: user.subPlan,
      subDate: user.subDate,
      subEndDate: user.subEndDate,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    };
  },
});

// Update subscription status
export const updateSubscription = mutation({
  args: {
    authId: v.string(),
    isPaidUser: v.boolean(),
    subStatus: v.optional(v.string()),
    subPlan: v.optional(v.string()),
    subDate: v.optional(v.number()),
    subEndDate: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const { authId, ...updates } = args;
    return await ctx.db.patch(user._id, updates);
  },
});

// Admin function to make a user paid (for testing)
export const makeUserPaid = mutation({
  args: {
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    await ctx.db.patch(user._id, {
      isPaidUser: true,
      subStatus: "active",
      subPlan: "monthly",
      subDate: Date.now(),
      subEndDate: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days from now
    });
    
    return { success: true, message: "User is now paid" };
  },
});

// Admin function to make a user free (for testing)
export const makeUserFree = mutation({
  args: {
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    await ctx.db.patch(user._id, {
      isPaidUser: false,
      subStatus: undefined,
      subPlan: undefined,
      subDate: undefined,
      subEndDate: undefined,
    });
    
    return { success: true, message: "User is now free" };
  },
});

// Admin query to list all users with complete data
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    return users.map(user => ({
      id: user._id,
      authId: user.authId,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      isPaidUser: user.isPaidUser,
      subStatus: user.subStatus,
      subPlan: user.subPlan,
      subDate: user.subDate,
      subEndDate: user.subEndDate,
    }));
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