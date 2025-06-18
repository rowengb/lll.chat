import { mutation } from "./_generated/server";

// One-time migration to seed favorites for all existing users
export const seedAllUserFavorites = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all users
    const users = await ctx.db.query("users").collect();
    
    // Get default favorite models
    const defaultFavorites = await ctx.db
      .query("models")
      .withIndex("by_favorite", (q: any) => q.eq("isFavorite", true))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();
    
    let seededCount = 0;
    
    for (const user of users) {
      // Check if user already has favorites
      const existingFavorites = await ctx.db
        .query("userModelFavorites")
        .withIndex("by_user", (q: any) => q.eq("userId", user._id))
        .collect();
      
      if (existingFavorites.length === 0) {
        // User has no favorites, seed them with defaults
        for (const model of defaultFavorites) {
          await ctx.db.insert("userModelFavorites", {
            userId: user._id,
            modelId: model.id,
          });
        }
        seededCount++;
      }
    }
    
    return { message: `Seeded favorites for ${seededCount} users` };
  },
}); 