import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const modelsConvexRouter = createTRPCRouter({
  getModels: protectedProcedure
    .query(async () => {
      return await convex.query(api.models.getModels);
    }),

  getFavoriteModels: protectedProcedure
    .query(async () => {
      return await convex.query(api.models.getFavoriteModels);
    }),

  getOtherModels: protectedProcedure
    .query(async () => {
      return await convex.query(api.models.getOtherModels);
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
}); 