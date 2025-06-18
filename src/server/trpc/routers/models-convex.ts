import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

export const modelsConvexRouter = createTRPCRouter({
  getModels: protectedProcedure
    .query(async () => {
      return await convex.query(api.models.getModels);
    }),

  getFavoriteModels: protectedProcedure
    .query(async ({ ctx }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      return await convex.query(api.models.getFavoriteModelsByUserId, {
        userId: convexUser._id,
      });
    }),

  getOtherModels: protectedProcedure
    .query(async ({ ctx }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      return await convex.query(api.models.getOtherModelsByUserId, {
        userId: convexUser._id,
      });
    }),

  getModelsByProvider: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.models.getModelsByProvider, {
        provider: input.provider,
      });
    }),

  getModel: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.models.getModel, {
        modelId: input.modelId,
      });
    }),

  seedModels: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.models.seedModels);
    }),

  addOpenRouterModelIds: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.models.addOpenRouterModelIds);
    }),

  updateQwenModelsToOpenRouter: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.models.updateQwenModelsToOpenRouter);
    }),

  toggleUserModelFavorite: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      return await convex.mutation(api.models.toggleUserModelFavoriteByUserId, {
        userId: convexUser._id,
        modelId: input.modelId,
      });
    }),

  isUserModelFavorited: protectedProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.models.isUserModelFavorited, {
        modelId: input.modelId,
      });
    }),

  seedFavoritesForExistingUser: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.models.seedFavoritesForExistingUser);
    }),

  seedAllUserFavorites: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.seedUserFavorites.seedAllUserFavorites);
    }),
}); 