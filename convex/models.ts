import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper function to seed default favorites for a new user
async function seedUserDefaultFavorites(ctx: any, userId: any) {
  const defaultFavorites = await ctx.db
    .query("models")
    .withIndex("by_favorite", (q: any) => q.eq("isFavorite", true))
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .collect();
  
  for (const model of defaultFavorites) {
    await ctx.db.insert("userModelFavorites", {
      userId,
      modelId: model.id,
    });
  }
}

// Get all active models ordered by favorites first, then by order
export const getModels = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Sort by favorites first, then by order
    return models.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.order - b.order;
    });
  },
});

// Get models by provider
export const getModelsByProvider = query({
  args: { provider: v.string() },
  handler: async (ctx, { provider }) => {
    return await ctx.db
      .query("models")
      .withIndex("by_provider", (q) => q.eq("provider", provider))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get user's favorite models (or default favorites if user has none set)
export const getFavoriteModels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      // User not authenticated, return default favorites
    return await ctx.db
      .query("models")
      .withIndex("by_favorite", (q) => q.eq("isFavorite", true))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      // User not found, return default favorites
      return await ctx.db
        .query("models")
        .withIndex("by_favorite", (q) => q.eq("isFavorite", true))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("asc")
        .collect();
    }

    // Get user's custom favorites
    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (userFavorites.length > 0) {
      // User has custom favorites, return those with isFavorite = true
      const favoriteModelIds = userFavorites.map(f => f.modelId);
      const models = await ctx.db
        .query("models")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      return models
        .filter(model => favoriteModelIds.includes(model.id))
        .map(model => ({ ...model, isFavorite: true }))
        .sort((a, b) => a.order - b.order);
    } else {
      // User has no custom favorites, return default favorites
      return await ctx.db
        .query("models")
        .withIndex("by_favorite", (q) => q.eq("isFavorite", true))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("asc")
        .collect();
    }
  },
});

// Get user's favorite models by userId (for server-side calls)
export const getFavoriteModelsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Get user's custom favorites
    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (userFavorites.length > 0) {
      // User has custom favorites, return those with isFavorite = true
      const favoriteModelIds = userFavorites.map(f => f.modelId);
      const models = await ctx.db
        .query("models")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      return models
        .filter(model => favoriteModelIds.includes(model.id))
        .map(model => ({ ...model, isFavorite: true }))
        .sort((a, b) => a.order - b.order);
    } else {
      // User has no custom favorites, return default favorites
      return await ctx.db
        .query("models")
        .withIndex("by_favorite", (q) => q.eq("isFavorite", true))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("asc")
        .collect();
    }
  },
});

// Get other (non-favorite) models for the user
export const getOtherModels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      // User not authenticated, return non-default favorites
    return await ctx.db
      .query("models")
      .withIndex("by_favorite", (q) => q.eq("isFavorite", false))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("asc")
      .collect();
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      // User not found, return non-default favorites
      return await ctx.db
        .query("models")
        .withIndex("by_favorite", (q) => q.eq("isFavorite", false))
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("asc")
        .collect();
    }

    // Get user's custom favorites
    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const favoriteModelIds = userFavorites.map(f => f.modelId);
    const models = await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (userFavorites.length > 0) {
      // User has custom favorites, return non-favorites with isFavorite = false
      return models
        .filter(model => !favoriteModelIds.includes(model.id))
        .map(model => ({ ...model, isFavorite: false }))
        .sort((a, b) => a.order - b.order);
    } else {
      // User has no custom favorites, return non-default favorites
      return models
        .filter(model => !model.isFavorite)
        .sort((a, b) => a.order - b.order);
    }
  },
});

// Get other (non-favorite) models by userId (for server-side calls)
export const getOtherModelsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Get user's custom favorites
    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const favoriteModelIds = userFavorites.map(f => f.modelId);
    const models = await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (userFavorites.length > 0) {
      // User has custom favorites, return non-favorites with isFavorite = false
      return models
        .filter(model => !favoriteModelIds.includes(model.id))
        .map(model => ({ ...model, isFavorite: false }))
        .sort((a, b) => a.order - b.order);
    } else {
      // User has no custom favorites, return non-default favorites
      return models
        .filter(model => !model.isFavorite)
        .sort((a, b) => a.order - b.order);
    }
  },
});

// Get a specific model by ID
export const getModel = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const model = await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("id"), modelId))
      .first();
    return model;
  },
});

// Add a new model
export const addModel = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    description: v.string(),
    provider: v.string(),
    apiUrl: v.optional(v.string()),
    capabilities: v.array(v.string()),
    isFavorite: v.boolean(),
    isActive: v.boolean(),
    order: v.number(),
    contextWindow: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    costPer1kTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("models", args);
  },
});

// Update a model
export const updateModel = mutation({
  args: {
    _id: v.id("models"),
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    provider: v.optional(v.string()),
    apiUrl: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    isFavorite: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
    contextWindow: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    costPer1kTokens: v.optional(v.number()),
  },
  handler: async (ctx, { _id, ...updates }) => {
    return await ctx.db.patch(_id, updates);
  },
});

// Delete a model
export const deleteModel = mutation({
  args: { _id: v.id("models") },
  handler: async (ctx, { _id }) => {
    return await ctx.db.delete(_id);
  },
});

// Toggle user model favorite (server-side version that takes userId)
export const toggleUserModelFavoriteByUserId = mutation({
  args: { userId: v.id("users"), modelId: v.string() },
  handler: async (ctx, { userId, modelId }) => {
    // Check if already favorited
    const existingFavorite = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user_model", (q) => q.eq("userId", userId).eq("modelId", modelId))
      .unique();

    if (existingFavorite) {
      // Remove from favorites
      await ctx.db.delete(existingFavorite._id);
      return { favorited: false };
    } else {
      // Add to favorites
      await ctx.db.insert("userModelFavorites", {
        userId,
        modelId,
      });
      return { favorited: true };
    }
  },
});

// Toggle user model favorite (client-side version for direct auth)
export const toggleUserModelFavorite = mutation({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("No identity found in toggleUserModelFavorite");
      throw new Error("Not authenticated");
    }
    
    console.log("User identity found:", { subject: identity.subject, name: identity.name });

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      // Create user if they don't exist
      const userId = await ctx.db.insert("users", {
        authId: identity.subject,
        name: identity.name,
        email: identity.email,
        image: identity.pictureUrl,
      });
      
      // Seed default favorites for the new user
      await seedUserDefaultFavorites(ctx, userId);
      
      user = await ctx.db.get(userId);
      if (!user) {
        throw new Error("Failed to create user");
      }
    }

    // Check if already favorited
    const existingFavorite = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user_model", (q) => q.eq("userId", user._id).eq("modelId", modelId))
      .unique();

    if (existingFavorite) {
      // Remove from favorites
      await ctx.db.delete(existingFavorite._id);
      return { favorited: false };
    } else {
      // Add to favorites
      await ctx.db.insert("userModelFavorites", {
        userId: user._id,
        modelId,
      });
      return { favorited: true };
    }
  },
});

// Seed favorites for existing users who don't have any favorites yet
export const seedFavoritesForExistingUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      // Create user if they don't exist
      const userId = await ctx.db.insert("users", {
        authId: identity.subject,
        name: identity.name,
        email: identity.email,
        image: identity.pictureUrl,
      });
      
      // Seed default favorites for the new user
      await seedUserDefaultFavorites(ctx, userId);
      return { message: "User created and favorites seeded" };
    }

    // Check if user already has favorites
    const existingFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    if (existingFavorites.length === 0) {
      // User exists but has no favorites, seed them
      await seedUserDefaultFavorites(ctx, user._id);
      return { message: "Favorites seeded for existing user" };
    }

    return { message: "User already has favorites" };
  },
});

// Check if user has favorited a model
export const isUserModelFavorited = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      return false;
    }

    const userFavorites = await ctx.db
      .query("userModelFavorites")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (userFavorites.length === 0) {
      // User has no custom favorites, check if it's a default favorite
      const model = await ctx.db
        .query("models")
        .filter((q) => q.eq(q.field("id"), modelId))
        .first();
      return model?.isFavorite || false;
    }

    // User has custom favorites, check if this model is in them
    return userFavorites.some(f => f.modelId === modelId);
  },
});

// Seed initial models data
export const seedModels = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if models already exist
    const existingModels = await ctx.db.query("models").first();
    if (existingModels) {
      return { message: "Models already seeded" };
    }

    const initialModels = [
      // Favorites
      {
        id: "gemini-2.0-flash-exp",
        name: "Gemini 2.5 Flash",
        description: "Fast multimodal model",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        capabilities: ["vision", "web", "documents"],
        isFavorite: true,
        isActive: true,
        order: 1,
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Advanced reasoning and multimodal",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        capabilities: ["vision", "web", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 2,
        contextWindow: 2000000,
        maxTokens: 8192,
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "OpenAI's flagship multimodal model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/chat/completions",
        capabilities: ["vision"],
        isFavorite: true,
        isActive: true,
        order: 3,
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        id: "o1-mini",
        name: "o4 mini",
        description: "Efficient reasoning model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/chat/completions",
        capabilities: ["vision", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 4,
        contextWindow: 128000,
        maxTokens: 65536,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 4 Sonnet",
        description: "Balanced performance",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents"],
        isFavorite: true,
        isActive: true,
        order: 5,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-3-5-sonnet-reasoning",
        name: "Claude 4 Sonnet (Reasoning)",
        description: "Enhanced reasoning capabilities",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 6,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "deepseek/deepseek-r1-distill-llama-70b",
        name: "DeepSeek R1 (Llama Distilled)",
        description: "Distilled reasoning model",
        provider: "deepseek",
        apiUrl: "https://api.deepseek.com/v1/chat/completions",
        capabilities: ["reasoning"],
        isFavorite: true,
        isActive: true,
        order: 7,
        contextWindow: 32768,
        maxTokens: 8192,
      },

      // Others
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Fast model",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        capabilities: ["vision", "web", "documents"],
        isFavorite: false,
        isActive: true,
        order: 10,
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT 4o-mini",
        description: "Compact model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/chat/completions",
        capabilities: ["vision"],
        isFavorite: false,
        isActive: true,
        order: 11,
        contextWindow: 128000,
        maxTokens: 16384,
      },
      {
        id: "claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        description: "Balanced Claude",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents"],
        isFavorite: false,
        isActive: true,
        order: 12,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70b",
        description: "Meta's model",
        provider: "meta",
        apiUrl: "https://api.llama-api.com/chat/completions",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 13,
        contextWindow: 32768,
        maxTokens: 8192,
      },
    ];

    // Insert all models
    const insertPromises = initialModels.map(model => ctx.db.insert("models", model));
    await Promise.all(insertPromises);

    return { message: `Seeded ${initialModels.length} models` };
  },
});

// Add API URLs to existing models
export const addApiUrls = mutation({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("models").collect();
    
    const apiUrlMap: Record<string, string> = {
      "openai": "https://api.openai.com/v1/chat/completions",
      "anthropic": "https://api.anthropic.com/v1/messages",
      "gemini": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      "deepseek": "https://api.deepseek.com/v1/chat/completions",
      "meta": "https://api.llama-api.com/chat/completions"
    };

    const updatePromises = models.map(model => {
      const apiUrl = apiUrlMap[model.provider];
      if (apiUrl && !model.apiUrl) {
        return ctx.db.patch(model._id, { apiUrl });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);
    return { message: "API URLs updated" };
  },
});

// Get model by ID (for AI client usage)
export const getModelById = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    return await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("id"), modelId))
      .first();
  },
});

// Add OpenRouter model IDs to existing models
export const addOpenRouterModelIds = mutation({
  args: {},
  handler: async (ctx) => {
    // Define OpenRouter model ID mappings
    const openRouterMappings: Record<string, string> = {
      // Gemini models
      "gemini-2.5-pro-preview-06-05": "google/gemini-2.5-pro-preview",
      "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash-preview",
      "gemini-2.0-flash": "google/gemini-2.0-flash",
      "gemini-2.0-flash-lite": "google/gemini-2.0-flash-lite",
      "gemini-1.5-pro": "google/gemini-1.5-pro",
      "gemini-1.5-flash": "google/gemini-1.5-flash",
      
      // OpenAI models
      "gpt-4o": "openai/gpt-4o",
      "gpt-4o-mini": "openai/gpt-4o-mini",
      "gpt-4": "openai/gpt-4",
      "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
      "o4-mini": "openai/o4-mini",
      "gpt-4.1": "openai/gpt-4.1",
      "gpt-4.1-mini": "openai/gpt-4.1-mini",
      
      // Anthropic models
      "claude-sonnet-4-20250514": "anthropic/claude-3.5-sonnet",
      "claude-sonnet-4-20250514-reasoning": "anthropic/claude-3.5-sonnet",
      "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
      "claude-3-opus": "anthropic/claude-3-opus",
      "claude-3-haiku": "anthropic/claude-3-haiku",
      
      // DeepSeek models
      "deepseek-r1-llama-70b": "deepseek/deepseek-r1-llama-70b",
      "deepseek-chat": "deepseek/deepseek-chat",
      "deepseek-coder": "deepseek/deepseek-coder",
      
      // Meta models
      "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
      "llama-3.1-405b": "meta-llama/llama-3.1-405b-instruct",
      
      // Other models that might be available on OpenRouter
      "grok-3-beta": "x-ai/grok-3-beta",
      "grok-3-mini-beta": "x-ai/grok-3-mini-beta",
    };

    // Update models with OpenRouter IDs
    const allModels = await ctx.db.query("models").collect();
    let updatedCount = 0;

    for (const model of allModels) {
      const openRouterModelId = openRouterMappings[model.id];
      if (openRouterModelId) {
        await ctx.db.patch(model._id, {
          openrouterModelId: openRouterModelId
        });
        updatedCount++;
      }
    }

    return { message: `Updated ${updatedCount} models with OpenRouter model IDs` };
  },
});

// Clear and reseed models with updated accurate data
export const updateModelsWithCorrectData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing models
    const existingModels = await ctx.db.query("models").collect();
    for (const model of existingModels) {
      await ctx.db.delete(model._id);
    }

    const updatedModels = [
      // FAVORITES (order 1-7)
      {
        id: "gemini-2.5-flash-preview-05-20",
        name: "Gemini 2.5 Flash",
        description: "Fast multimodal model with enhanced capabilities",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
        capabilities: ["vision", "web", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 1,
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.5-pro-preview-06-05",
        name: "Gemini 2.5 Pro",
        description: "Advanced reasoning and multimodal capabilities",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
        capabilities: ["vision", "web", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 2,
        contextWindow: 2000000,
        maxTokens: 8192,
      },
      {
        id: "gpt-image-1",
        name: "GPT ImageGen",
        description: "OpenAI image generation model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/images/generations",
        capabilities: ["image-generation"],
        isFavorite: true,
        isActive: true,
        order: 3,
        contextWindow: 4000,
        maxTokens: 1000,
      },
      {
        id: "o4-mini",
        name: "o4 mini",
        description: "Efficient reasoning model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["reasoning"],
        isFavorite: true,
        isActive: true,
        order: 4,
        contextWindow: 128000,
        maxTokens: 65536,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude 4 Sonnet",
        description: "Advanced language model with exceptional reasoning",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 5,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-sonnet-4-20250514-reasoning",
        name: "Claude 4 Sonnet",
        description: "Enhanced reasoning capabilities (Reasoning)",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: true,
        isActive: true,
        order: 6,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "deepseek-r1-llama-70b",
        name: "DeepSeek R1",
        description: "Distilled reasoning model (Llama Distilled)",
        provider: "deepseek",
        apiUrl: "https://api.deepseek.com/",
        capabilities: ["reasoning"],
        isFavorite: true,
        isActive: true,
        order: 7,
        contextWindow: 32768,
        maxTokens: 8192,
      },

      // OTHERS (order 10+)
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Fast model with multimodal capabilities",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
        capabilities: ["vision", "web", "documents"],
        isFavorite: false,
        isActive: true,
        order: 10,
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        description: "Lightweight version of Gemini 2.0 Flash",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
        capabilities: ["vision"],
        isFavorite: false,
        isActive: true,
        order: 11,
        contextWindow: 500000,
        maxTokens: 4096,
      },
      {
        id: "gemini-2.5-flash-preview-05-20-thinking",
        name: "Gemini 2.5 Flash",
        description: "Enhanced reasoning with thinking mode (Thinking)",
        provider: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
        capabilities: ["vision", "web", "documents", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 12,
        contextWindow: 1000000,
        maxTokens: 8192,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT 4o-mini",
        description: "Compact and efficient OpenAI model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["vision"],
        isFavorite: false,
        isActive: true,
        order: 13,
        contextWindow: 128000,
        maxTokens: 16384,
      },
      {
        id: "gpt-4o",
        name: "GPT 4o",
        description: "OpenAI's flagship multimodal model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["vision"],
        isFavorite: false,
        isActive: true,
        order: 14,
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        id: "gpt-4.1",
        name: "GPT 4.1",
        description: "Next generation OpenAI model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["vision", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 15,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT 4.1 Mini",
        description: "Compact version of GPT 4.1",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["vision"],
        isFavorite: false,
        isActive: true,
        order: 16,
        contextWindow: 128000,
        maxTokens: 4096,
      },
      {
        id: "gpt-4.1-nano",
        name: "GPT 4.1 Nano",
        description: "Ultra-compact version of GPT 4.1",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 17,
        contextWindow: 32000,
        maxTokens: 2048,
      },
      {
        id: "o3-mini",
        name: "o3 mini",
        description: "Advanced reasoning model - compact version",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 18,
        contextWindow: 128000,
        maxTokens: 65536,
      },
      {
        id: "o3",
        name: "o3",
        description: "Advanced reasoning model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 19,
        contextWindow: 200000,
        maxTokens: 100000,
      },
      {
        id: "claude-3-5-sonnet-20240620",
        name: "Claude 3.5 Sonnet",
        description: "Balanced Claude model",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents"],
        isFavorite: false,
        isActive: true,
        order: 20,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Enhanced Claude model",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 21,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-3-7-sonnet-20250219-reasoning",
        name: "Claude 3.7 Sonnet",
        description: "Enhanced reasoning capabilities (Reasoning)",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 22,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude 4 Opus",
        description: "Premium Claude model with advanced capabilities",
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1/messages",
        capabilities: ["vision", "documents", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 23,
        contextWindow: 200000,
        maxTokens: 8192,
      },
      {
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        name: "Llama 3.3 70b",
        description: "Meta's large language model",
        provider: "together",
        apiUrl: "https://api.together.xyz/v1/chat/completions",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 24,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        name: "Llama 4 Scout",
        description: "Next-gen Meta model - Scout variant",
        provider: "together",
        apiUrl: "https://api.together.xyz/v1/chat/completions",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 25,
        contextWindow: 64000,
        maxTokens: 8192,
      },
      {
        id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        name: "Llama 4 Maverick",
        description: "Next-gen Meta model - Maverick variant",
        provider: "together",
        apiUrl: "https://api.together.xyz/v1/chat/completions",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 26,
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        id: "accounts/fireworks/models/deepseek-v3",
        name: "DeepSeek v3",
        description: "Advanced model via Fireworks (Fireworks)",
        provider: "fireworks",
        apiUrl: "https://api.fireworks.ai/inference/v1",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 27,
        contextWindow: 64000,
        maxTokens: 8192,
      },
      {
        id: "deepseek-v3-0324",
        name: "DeepSeek v3",
        description: "Latest DeepSeek model (0324)",
        provider: "deepseek",
        apiUrl: "https://api.deepseek.com/",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 28,
        contextWindow: 64000,
        maxTokens: 8192,
      },
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        description: "Reasoning model via OpenRouter (OpenRouter)",
        provider: "openrouter",
        apiUrl: "https://openrouter.ai/api/v1/chat/completions",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 29,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "deepseek-r1-0528",
        name: "DeepSeek R1",
        description: "Latest reasoning model (0528)",
        provider: "deepseek",
        apiUrl: "https://api.deepseek.com/",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 30,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "deepseek-r1-distilled-qwen-32b",
        name: "DeepSeek R1",
        description: "Distilled reasoning model (Qwen Distilled)",
        provider: "deepseek",
        apiUrl: "https://api.deepseek.com/",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 31,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "grok-3-beta",
        name: "Grok 3",
        description: "X.AI's advanced language model",
        provider: "xai",
        apiUrl: "https://api.x.ai/v1/chat/completions",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 32,
        contextWindow: 128000,
        maxTokens: 8192,
      },
      {
        id: "grok-3-mini-beta",
        name: "Grok 3 Mini",
        description: "Compact version of Grok 3",
        provider: "xai",
        apiUrl: "https://api.x.ai/v1/chat/completions",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 33,
        contextWindow: 64000,
        maxTokens: 4096,
      },
      {
        id: "Qwen/QwQ-32B",
        name: "Qwen qwkq-32b",
        description: "Qwen question-answering model (OpenRouter only)",
        provider: "openrouter",
        apiUrl: "https://openrouter.ai/api/v1/chat/completions",
        openrouterModelId: "qwen/qwq-32b-preview",
        capabilities: ["reasoning"],
        isFavorite: false,
        isActive: true,
        order: 34,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "qwen2.5-32b-instruct",
        name: "Qwen 2.5 32b",
        description: "Alibaba's Qwen model (OpenRouter only)",
        provider: "openrouter",
        apiUrl: "https://openrouter.ai/api/v1/chat/completions",
        openrouterModelId: "qwen/qwen-2.5-32b-instruct",
        capabilities: [],
        isFavorite: false,
        isActive: true,
        order: 35,
        contextWindow: 32768,
        maxTokens: 8192,
      },
      {
        id: "gpt-4.5-preview",
        name: "GPT 4.5",
        description: "Next generation OpenAI preview model",
        provider: "openai",
        apiUrl: "https://api.openai.com/v1/",
        capabilities: ["vision", "reasoning"],
        isFavorite: false,
        isActive: true,
        order: 36,
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ];

    // Insert all models
    const insertPromises = updatedModels.map(model => ctx.db.insert("models", model));
    await Promise.all(insertPromises);

    return { message: `Updated database with ${updatedModels.length} correct models with accurate API data` };
  },
});

// Update all models with correct capabilities and subtitles
export const updateModelCapabilitiesAndSubtitles = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all existing models
    const existingModels = await ctx.db.query("models").collect();

    // Define the capability updates based on the user's table
    const modelUpdates = [
      // FAVORITES
      {
        id: "gemini-2.5-flash-preview-05-20",
        capabilities: ["vision", "web", "documents"],
        subtitle: null
      },
      {
        id: "gemini-2.5-pro-preview-06-05", 
        capabilities: ["vision", "web", "documents", "reasoning"],
        subtitle: null
      },
      {
        id: "gpt-image-1",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "o4-mini",
        capabilities: ["vision", "reasoning"],
        subtitle: null
      },
      {
        id: "claude-sonnet-4-20250514",
        capabilities: ["vision", "documents"],
        subtitle: null
      },
      {
        id: "claude-sonnet-4-20250514-reasoning",
        capabilities: ["vision", "documents", "reasoning"],
        subtitle: "(Reasoning)"
      },
      {
        id: "deepseek-r1-llama-70b",
        capabilities: ["reasoning"],
        subtitle: "(Llama Distilled)"
      },

      // OTHERS
      {
        id: "gemini-2.0-flash",
        capabilities: ["vision", "web", "documents"],
        subtitle: null
      },
      {
        id: "gemini-2.0-flash-lite",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "gemini-2.5-flash-preview-05-20-thinking",
        capabilities: ["vision", "web", "documents"],
        subtitle: "(Thinking)"
      },
      {
        id: "gpt-4o-mini",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "gpt-4o",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "gpt-4.1",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "gpt-4.1-mini",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "gpt-4.1-nano",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "o3-mini",
        capabilities: ["reasoning"],
        subtitle: null
      },
      {
        id: "o3",
        capabilities: ["vision", "reasoning"],
        subtitle: null
      },
      {
        id: "claude-3-5-sonnet-20240620",
        capabilities: ["vision", "documents"],
        subtitle: null
      },
      {
        id: "claude-3-7-sonnet-20250219",
        capabilities: ["vision", "documents"],
        subtitle: null
      },
      {
        id: "claude-3-7-sonnet-20250219-reasoning",
        capabilities: ["vision", "documents", "reasoning"],
        subtitle: "(Reasoning)"
      },
      {
        id: "claude-opus-4-20250514",
        capabilities: ["vision", "documents"],
        subtitle: null
      },
      {
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        capabilities: ["experimental"],
        subtitle: null
      },
      {
        id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
        capabilities: ["vision"],
        subtitle: null
      },
      {
        id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        capabilities: ["experimental"],
        subtitle: null
      },
      {
        id: "accounts/fireworks/models/deepseek-v3",
        capabilities: ["experimental"],
        subtitle: "(Fireworks)"
      },
      {
        id: "deepseek-v3-0324",
        capabilities: ["experimental"],
        subtitle: "(0324)"
      },
      {
        id: "deepseek/deepseek-r1",
        capabilities: ["reasoning"],
        subtitle: "(OpenRouter)"
      },
      {
        id: "deepseek-r1-0528",
        capabilities: ["reasoning", "experimental"],
        subtitle: "(0528)"
      },
      {
        id: "deepseek-r1-distilled-qwen-32b",
        capabilities: ["reasoning", "experimental"],
        subtitle: "(Qwen Distilled)"
      },
      {
        id: "grok-3-beta",
        capabilities: [],
        subtitle: null
      },
      {
        id: "grok-3-mini-beta",
        capabilities: ["reasoning", "experimental"],
        subtitle: null
      },
      {
        id: "Qwen/QwQ-32B",
        capabilities: ["reasoning"],
        subtitle: null
      },
      {
        id: "qwen2.5-32b-instruct",
        capabilities: ["experimental"],
        subtitle: null
      },
      {
        id: "gpt-4.5-preview",
        capabilities: ["vision"],
        subtitle: null
      },
    ];

    // Update each model
    let updatedCount = 0;
    for (const modelUpdate of modelUpdates) {
      const existingModel = existingModels.find(m => m.id === modelUpdate.id);
      if (existingModel) {
        const updateData: any = {
          capabilities: modelUpdate.capabilities,
        };
        
        // Only add subtitle if it's not null
        if (modelUpdate.subtitle) {
          updateData.subtitle = modelUpdate.subtitle;
        }
        
        await ctx.db.patch(existingModel._id, updateData);
        updatedCount++;
      }
    }

    return { 
      message: `Updated capabilities and subtitles for ${updatedCount} models`,
      totalModels: existingModels.length 
    };
  },
});

// Update all models with strategic display name splits for two-line display
export const updateModelDisplayNames = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all existing models
    const existingModels = await ctx.db.query("models").collect();

    // Define strategic display name splits
    const displayNameSplits: Record<string, { top: string; bottom: string }> = {
      // FAVORITES
      "gemini-2.5-flash-preview-05-20": { top: "Gemini", bottom: "2.5 Flash" },
      "gemini-2.5-pro-preview-06-05": { top: "Gemini", bottom: "2.5 Pro" },
      "gpt-image-1": { top: "GPT", bottom: "ImageGen" },
      "o4-mini": { top: "o4", bottom: "Mini" },
      "claude-sonnet-4-20250514": { top: "Claude", bottom: "4 Sonnet" },
      "claude-sonnet-4-20250514-reasoning": { top: "Claude", bottom: "4 Sonnet" },
      "deepseek-r1-llama-70b": { top: "DeepSeek", bottom: "R1 Llama" },

      // OTHERS
      "gemini-2.0-flash": { top: "Gemini", bottom: "2.0 Flash" },
      "gemini-2.0-flash-lite": { top: "Gemini", bottom: "2.0 Lite" },
      "gemini-2.5-flash-preview-05-20-thinking": { top: "Gemini", bottom: "2.5 Flash" },
      "gpt-4o-mini": { top: "GPT", bottom: "4o Mini" },
      "gpt-4o": { top: "GPT", bottom: "4o" },
      "gpt-4.1": { top: "GPT", bottom: "4.1" },
      "gpt-4.1-mini": { top: "GPT", bottom: "4.1 Mini" },
      "gpt-4.1-nano": { top: "GPT", bottom: "4.1 Nano" },
      "o1": { top: "o1", bottom: "Full" },
      "o1-mini": { top: "o1", bottom: "Mini" },
      "o1-preview": { top: "o1", bottom: "Preview" },
      "o3": { top: "o3", bottom: "Full" },
      "o3-mini": { top: "o3", bottom: "Mini" },
      "claude-3-5-sonnet-20240620": { top: "Claude", bottom: "3.5 Sonnet" },
      "claude-3-7-sonnet-20250219": { top: "Claude", bottom: "3.7 Sonnet" },
      "claude-3-7-sonnet-20250219-reasoning": { top: "Claude", bottom: "3.7 Sonnet" },
      "claude-haiku-4-20250514": { top: "Claude", bottom: "4 Haiku" },
      "claude-opus-4-20250514": { top: "Claude", bottom: "4 Opus" },
      "meta-llama/Llama-3.3-70B-Instruct-Turbo": { top: "Llama", bottom: "3.3 70b" },
      "meta-llama/Llama-4-Scout-17B-16E-Instruct": { top: "Llama", bottom: "4 Scout" },
      "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": { top: "Llama", bottom: "4 Maverick" },
      "accounts/fireworks/models/deepseek-v3": { top: "DeepSeek", bottom: "V3" },
      "deepseek-v3-0324": { top: "DeepSeek", bottom: "V3" },
      "deepseek/deepseek-r1": { top: "DeepSeek", bottom: "R1" },
      "deepseek-r1-0528": { top: "DeepSeek", bottom: "R1" },
      "deepseek-r1-distilled-qwen-32b": { top: "DeepSeek", bottom: "R1 Qwen" },
      "accounts/fireworks/models/llama-v3p3-70b-instruct": { top: "Llama", bottom: "3.3 70b" },
      "microsoft/WizardLM-2-8x22B": { top: "WizardLM", bottom: "2 8x22B" },
      "grok-3-beta": { top: "Grok", bottom: "3" },
      "grok-3-mini-beta": { top: "Grok", bottom: "3 Mini" },
      "Qwen/QwQ-32B": { top: "Qwen", bottom: "QwQ 32B" },
      "qwen2.5-32b-instruct": { top: "Qwen", bottom: "2.5 32b" },
      "gpt-4.5-preview": { top: "GPT", bottom: "4.5" },
    };

    // Update models with display name splits
    const updatePromises = existingModels.map(async (model) => {
      const split = displayNameSplits[model.id];
      if (split) {
        return ctx.db.patch(model._id, {
          displayNameTop: split.top,
          displayNameBottom: split.bottom
        });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    const updatedCount = existingModels.filter(model => displayNameSplits[model.id]).length;
    return { message: `Updated ${updatedCount} models with strategic display name splits` };
  },
});

// Update remaining models that didn't match in the first pass
export const updateRemainingModelDisplayNames = mutation({
  args: {},
  handler: async (ctx) => {
    // Define the remaining models that need display name splits
    const remainingModels = [
      { id: "gpt-4.1-mini", top: "GPT", bottom: "4.1 Mini" },
      { id: "gpt-4.1-nano", top: "GPT", bottom: "4.1 Nano" },
      { id: "o3", top: "o3", bottom: "Full" },
      { id: "claude-3-5-sonnet-20240620", top: "Claude", bottom: "3.5 Sonnet" },
      { id: "claude-3-7-sonnet-20250219", top: "Claude", bottom: "3.7 Sonnet" },
      { id: "claude-3-7-sonnet-20250219-reasoning", top: "Claude", bottom: "3.7 Sonnet" },
      { id: "accounts/fireworks/models/deepseek-v3", top: "DeepSeek", bottom: "V3" },
      { id: "deepseek-v3-0324", top: "DeepSeek", bottom: "V3" },
      { id: "deepseek/deepseek-r1", top: "DeepSeek", bottom: "R1" },
      { id: "deepseek-r1-0528", top: "DeepSeek", bottom: "R1" },
      { id: "deepseek-r1-distilled-qwen-32b", top: "DeepSeek", bottom: "R1 Qwen" },
    ];

    let updatedCount = 0;

    for (const modelData of remainingModels) {
      // Find the model by id
      const existingModel = await ctx.db
        .query("models")
        .filter((q) => q.eq(q.field("id"), modelData.id))
        .first();
      
      if (existingModel) {
        // Update with display names
        await ctx.db.patch(existingModel._id, {
          displayNameTop: modelData.top,
          displayNameBottom: modelData.bottom
        });
        updatedCount++;
      }
    }

    return { message: `Updated ${updatedCount} remaining models with strategic display name splits` };
  },
});

// Update models with pricing information
// Update Qwen models to use OpenRouter only
export const updateQwenModelsToOpenRouter = mutation({
  args: {},
  handler: async (ctx) => {
    // Find and update Qwen models
    const qwenModels = await ctx.db.query("models").collect();
    
    let updatedCount = 0;
    
    for (const model of qwenModels) {
      if (model.id === "Qwen/QwQ-32B") {
        await ctx.db.patch(model._id, {
          description: "Qwen question-answering model (OpenRouter only)",
          provider: "openrouter",
          apiUrl: "https://openrouter.ai/api/v1/chat/completions",
          openrouterModelId: "qwen/qwq-32b-preview",
        });
        updatedCount++;
      } else if (model.id === "qwen2.5-32b-instruct") {
        await ctx.db.patch(model._id, {
          description: "Alibaba's Qwen model (OpenRouter only)",
          provider: "openrouter", 
          apiUrl: "https://openrouter.ai/api/v1/chat/completions",
          openrouterModelId: "qwen/qwen-2.5-32b-instruct",
        });
        updatedCount++;
      }
    }
    
    return { message: `Updated ${updatedCount} Qwen models to use OpenRouter only` };
  },
});

export const updateModelsWithPricing = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all existing models
    const existingModels = await ctx.db.query("models").collect();

    // Define pricing per 1k tokens (input tokens, typical average cost)
    // Based on real API pricing as of 2024
    const pricingData: Record<string, number> = {
      // OpenAI models
      "gpt-4o-mini": 0.00015,           // $0.15 per 1M tokens
      "gpt-4o": 0.0025,                 // $2.50 per 1M tokens  
      "gpt-4.1": 0.003,                 // $3.00 per 1M tokens (estimated)
      "gpt-4.1-mini": 0.0008,           // $0.80 per 1M tokens (estimated)
      "gpt-4.1-nano": 0.0002,           // $0.20 per 1M tokens (estimated)
      "o4-mini": 0.003,                 // $3.00 per 1M tokens (estimated)
      "o1": 0.015,                      // $15.00 per 1M tokens (estimated)
      "o1-mini": 0.003,                 // $3.00 per 1M tokens (estimated)
      "o1-preview": 0.015,              // $15.00 per 1M tokens
      "o3": 0.06,                       // $60.00 per 1M tokens (estimated)
      "o3-mini": 0.008,                 // $8.00 per 1M tokens (estimated)
      "gpt-image-1": 0.04,              // $40.00 per 1K images
      "gpt-4.5-preview": 0.005,         // $5.00 per 1M tokens (estimated)

      // Anthropic models
      "claude-3-5-sonnet-20240620": 0.003,      // $3.00 per 1M tokens
      "claude-sonnet-4-20250514": 0.003,        // $3.00 per 1M tokens (estimated)
      "claude-sonnet-4-20250514-reasoning": 0.003, // $3.00 per 1M tokens (estimated)
      "claude-3-7-sonnet-20250219": 0.0035,     // $3.50 per 1M tokens (estimated)
      "claude-3-7-sonnet-20250219-reasoning": 0.0035, // $3.50 per 1M tokens (estimated)
      "claude-opus-4-20250514": 0.015,          // $15.00 per 1M tokens (estimated)

      // Google models
      "gemini-2.5-flash-preview-05-20": 0.000075, // $0.075 per 1M tokens
      "gemini-2.5-pro-preview-06-05": 0.0035,     // $3.50 per 1M tokens  
      "gemini-2.0-flash": 0.000075,               // $0.075 per 1M tokens
      "gemini-2.0-flash-lite": 0.000035,          // $0.035 per 1M tokens
      "gemini-2.5-flash-preview-05-20-thinking": 0.000075, // $0.075 per 1M tokens

      // DeepSeek models
      "deepseek-r1-llama-70b": 0.0001,            // $0.10 per 1M tokens (estimated)
      "deepseek-v3-0324": 0.0001,                 // $0.10 per 1M tokens (estimated)
      "deepseek/deepseek-r1": 0.0001,             // $0.10 per 1M tokens (estimated)
      "deepseek-r1-0528": 0.0001,                 // $0.10 per 1M tokens (estimated)
      "deepseek-r1-distilled-qwen-32b": 0.0001,   // $0.10 per 1M tokens (estimated)
      "accounts/fireworks/models/deepseek-v3": 0.0002, // $0.20 per 1M tokens (Fireworks markup)

      // X.AI Grok models
      "grok-3-beta": 0.002,                       // $2.00 per 1M tokens (estimated)
      "grok-3-mini-beta": 0.0005,                 // $0.50 per 1M tokens (estimated)

      // Together.ai/Meta models
      "meta-llama/Llama-3.3-70B-Instruct-Turbo": 0.0009, // $0.90 per 1M tokens
      "meta-llama/Llama-4-Scout-17B-16E-Instruct": 0.0005, // $0.50 per 1M tokens (estimated)
      "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": 0.0005, // $0.50 per 1M tokens (estimated)
      "accounts/fireworks/models/llama-v3p3-70b-instruct": 0.0009, // $0.90 per 1M tokens

      // Other models
      "Qwen/QwQ-32B": 0.0008,                     // $0.80 per 1M tokens (estimated)
      "qwen2.5-32b-instruct": 0.0008,             // $0.80 per 1M tokens (estimated)
      "microsoft/WizardLM-2-8x22B": 0.0012,       // $1.20 per 1M tokens (estimated)
    };

    // Update models with pricing
    const updatePromises = existingModels.map(async (model) => {
      const cost = pricingData[model.id];
      if (cost !== undefined) {
        return ctx.db.patch(model._id, {
          costPer1kTokens: cost
        });
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);

    const updatedCount = existingModels.filter(model => pricingData[model.id] !== undefined).length;
    return { message: `Updated ${updatedCount} models with pricing information` };
  },
}); 