import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Export all models data for migration
export const exportModelsData = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query("models").collect();
    
    // Remove Convex-specific fields for clean migration
    const cleanModels = models.map(model => {
      const { _id, _creationTime, ...cleanModel } = model;
      return cleanModel;
    });
    
    return {
      models: cleanModels,
      count: cleanModels.length,
      exportedAt: new Date().toISOString()
    };
  },
});

// Import models data (replaces all existing models)
export const importModelsData = mutation({
  args: {
    models: v.array(v.object({
      id: v.string(),
      name: v.string(),
      displayNameTop: v.optional(v.string()),
      displayNameBottom: v.optional(v.string()),
      description: v.string(),
      subtitle: v.optional(v.string()),
      provider: v.string(),
      apiUrl: v.optional(v.string()),
      openrouterModelId: v.optional(v.string()),
      capabilities: v.array(v.string()),
      isFavorite: v.boolean(),
      isActive: v.boolean(),
      order: v.number(),
      contextWindow: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      costPer1kTokens: v.optional(v.number()),
    }))
  },
  handler: async (ctx, { models }) => {
    // Delete all existing models
    const existingModels = await ctx.db.query("models").collect();
    for (const model of existingModels) {
      await ctx.db.delete(model._id);
    }
    
    // Insert new models
    const insertPromises = models.map(model => ctx.db.insert("models", model));
    await Promise.all(insertPromises);
    
    return { 
      message: `Successfully imported ${models.length} models`,
      deletedCount: existingModels.length,
      importedCount: models.length
    };
  },
}); 