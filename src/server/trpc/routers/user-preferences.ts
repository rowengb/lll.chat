import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Type definition for model data from Convex
interface ModelData {
  _id: string;
  id: string;
  name: string;
  displayNameTop?: string;
  displayNameBottom?: string;
  description: string;
  provider: string;
  apiUrl?: string;
  openrouterModelId?: string;
  capabilities: string[];
  isFavorite: boolean;
  isActive: boolean;
  order: number;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kTokens?: number;
  subtitle?: string;
}

// Helper function to get or create user in Convex
async function getOrCreateConvexUser(authId: string) {
  try {
    let user = await convex.query(api.users.getByAuthId, { authId });

    if (!user) {
      const userId = await convex.mutation(api.users.create, {
        authId,
      });
      user = await convex.query(api.users.getByAuthId, { authId });
    }

    return user;
  } catch (error) {
    console.error("Error getting or creating user:", error);
    return null;
  }
}

export const userPreferencesRouter = createTRPCRouter({
  // Get user preferences including default model
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const convexUser = await getOrCreateConvexUser(ctx.userId);

    if (!convexUser) {
      throw new Error("Failed to get or create user");
    }

    const preferences = await convex.query(api.users.getPreferences, {
      userId: convexUser._id,
    });

    return preferences || { defaultModel: null };
  }),

  // Set user's default model
  setDefaultModel: protectedProcedure
    .input(z.object({
      modelId: z.string().min(1, "Model ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      await convex.mutation(api.users.updatePreferences, {
        userId: convexUser._id,
        defaultModel: input.modelId,
      });

      return { success: true, defaultModel: input.modelId };
    }),

  // Set user's title generation model
  setTitleGenerationModel: protectedProcedure
    .input(z.object({
      modelId: z.string().min(1, "Model ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      await convex.mutation(api.users.updatePreferences, {
        userId: convexUser._id,
        titleGenerationModel: input.modelId,
      });

      return { success: true, titleGenerationModel: input.modelId };
    }),

  // Get the best default model for user (either user's preference or cheapest available)
  getBestDefaultModel: protectedProcedure.query(async ({ ctx }) => {
    const convexUser = await getOrCreateConvexUser(ctx.userId);

    if (!convexUser) {
      throw new Error("Failed to get or create user");
    }

    // Get user preferences
    const preferences = await convex.query(api.users.getPreferences, {
      userId: convexUser._id,
    });

    // Get user's API keys to check which models are available
    const apiKeys = await convex.query(api.apiKeys.getByUser, {
      userId: convexUser._id,
    });

    // Get all models
    const allModels = await convex.query(api.models.getModels, {}) as ModelData[];

    // Create a map of available providers (those with API keys)
    const availableProviders = new Set(apiKeys.map(key => key.provider));

    // Filter models to only those with available API keys
    const availableModels = allModels.filter((model: ModelData) => 
      availableProviders.has(model.provider) && model.isActive
    );

    // If user has a default model set and it's available, use it
    if (preferences?.defaultModel) {
      const defaultModel = availableModels.find((model: ModelData) => model.id === preferences.defaultModel);
      if (defaultModel) {
        return {
          modelId: defaultModel.id,
          reason: "user_preference",
          modelName: defaultModel.name
        };
      }
    }

    // Otherwise, find the cheapest available model
    if (availableModels.length > 0) {
      // Sort by cost (cheapest first), fallback to favorite models if no cost data
      const cheapestModel = availableModels
        .filter((model: ModelData) => model.costPer1kTokens !== undefined)
        .sort((a: ModelData, b: ModelData) => (a.costPer1kTokens || 0) - (b.costPer1kTokens || 0))[0] ||
        availableModels.filter((model: ModelData) => model.isFavorite)[0] ||
        availableModels[0];

      if (cheapestModel) {
        return {
          modelId: cheapestModel.id,
          reason: cheapestModel.costPer1kTokens !== undefined ? "cheapest_available" : "first_available",
          modelName: cheapestModel.name,
          cost: cheapestModel.costPer1kTokens
        };
      }
    }

    // No models available - user needs to add API keys
    return {
      modelId: null,
      reason: "no_api_keys",
      modelName: null
    };
  }),
}); 