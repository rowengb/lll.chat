import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import CryptoJS from "crypto-js";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Use environment variable for encryption secret
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";

// Helper functions for encryption/decryption
const encryptApiKey = (key: string): string => {
  return CryptoJS.AES.encrypt(key, ENCRYPTION_SECRET).toString();
};

const decryptApiKey = (encryptedKey: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Helper to get or create user in Convex
const getOrCreateConvexUser = async (clerkUserId: string) => {
  let user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
  
  if (!user) {
    const newUserId = await convex.mutation(api.users.create, {
      authId: clerkUserId,
      name: undefined,
      email: undefined,
      image: undefined,
    });
    // Fetch the created user
    user = await convex.query(api.users.getByAuthId, { authId: clerkUserId });
  }
  
  return user;
};

export const apiKeysConvexRouter = createTRPCRouter({
  // Get all API keys for the current user
  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const convexUser = await getOrCreateConvexUser(ctx.userId);

    if (!convexUser) {
      throw new Error("Failed to get or create user");
    }

    const apiKeys = await convex.query(api.apiKeys.getByUser, {
      userId: convexUser._id,
    });

    // Return decrypted keys
    const decryptedKeys: Record<string, string> = {};
    apiKeys.forEach(key => {
      try {
        decryptedKeys[key.provider] = decryptApiKey(key.keyValue);
      } catch (error) {
        console.error(`Error decrypting key for provider ${key.provider}:`, error);
      }
    });

    return decryptedKeys;
  }),

  // Save or update an API key
  saveApiKey: protectedProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "gemini", "deepseek", "meta"]),
      key: z.string().min(1, "API key cannot be empty"),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const encryptedKey = encryptApiKey(input.key);

      const result = await convex.mutation(api.apiKeys.create, {
        userId: convexUser._id,
        provider: input.provider,
        keyValue: encryptedKey,
      });

      return { success: true, id: result };
    }),

  // Delete an API key
  deleteApiKey: protectedProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "gemini", "deepseek", "meta"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const apiKey = await convex.query(api.apiKeys.getByUserAndProvider, {
        userId: convexUser._id,
        provider: input.provider,
      });

      if (apiKey) {
        await convex.mutation(api.apiKeys.deleteKey, {
          id: apiKey._id,
        });
      }

      return { success: true };
    }),

  // Check if user has API keys for specific providers
  hasApiKeys: protectedProcedure
    .input(z.object({
      providers: z.array(z.enum(["openai", "anthropic", "gemini", "deepseek", "meta"])),
    }))
    .query(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        return {};
      }

      const apiKeys = await convex.query(api.apiKeys.getByUser, {
        userId: convexUser._id,
      });

      const hasKeys: Record<string, boolean> = {};
      input.providers.forEach(provider => {
        hasKeys[provider] = apiKeys.some(key => key.provider === provider);
      });

      return hasKeys;
    }),

  // Check if user has any API keys at all
  hasAnyApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const convexUser = await getOrCreateConvexUser(ctx.userId);

    if (!convexUser) {
      return false;
    }

    const apiKeys = await convex.query(api.apiKeys.getByUser, {
      userId: convexUser._id,
    });

    // Check if user has at least one valid API key (non-empty)
    return apiKeys.some(key => {
      try {
        const decryptedKey = decryptApiKey(key.keyValue);
        return decryptedKey && decryptedKey.trim().length > 0;
      } catch (error) {
        console.error(`Error decrypting key for provider ${key.provider}:`, error);
        return false;
      }
    });
  }),
}); 