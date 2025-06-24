"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { createClerkClient } from "@clerk/nextjs/server";
import { api } from "./_generated/api";

// Action to sync all Clerk users to Convex
export const syncUsersFromClerk = action({
  args: {},
  handler: async (ctx) => {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required");
    }

    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    try {
      console.log("🔄 Starting Clerk user sync...");
      
      // Fetch all users from Clerk
      const clerkUsers = await clerkClient.users.getUserList({ limit: 500 });
      
      let synced = 0;
      let created = 0;
      let updated = 0;

      for (const clerkUser of clerkUsers.data) {
        try {
          const authId = clerkUser.id;
          const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;
          const email = clerkUser.emailAddresses[0]?.emailAddress || undefined;
          const image = clerkUser.imageUrl || undefined;
          const createdAt = clerkUser.createdAt;

          // Check if user exists in Convex
          const existingUser = await ctx.runQuery(api.users.getByAuthId, { authId });

          if (existingUser) {
            // Update existing user with complete data using the existing mutation
            await ctx.runMutation(api.users.create, {
              authId,
              name,
              email,
              image,
              createdAt,
            });
            updated++;
          } else {
            // Create new user with complete data
            await ctx.runMutation(api.users.create, {
              authId,
              name,
              email,
              image,
              createdAt,
            });
            created++;
          }
          synced++;
        } catch (userError) {
          console.error(`Error syncing user ${clerkUser.id}:`, userError);
        }
      }

      console.log(`✅ Clerk sync complete: ${synced} users processed, ${created} created, ${updated} updated`);
      
      return {
        success: true,
        totalUsers: clerkUsers.data.length,
        synced,
        created,
        updated,
      };

    } catch (error) {
      console.error("❌ Error syncing users from Clerk:", error);
      throw new Error(`Failed to sync users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Action to sync a single user from Clerk by authId
export const syncSingleUserFromClerk = action({
  args: { authId: v.string() },
  handler: async (ctx, { authId }) => {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required");
    }

    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    try {
      console.log(`🔄 Syncing single user: ${authId}`);
      
      // Fetch specific user from Clerk
      const clerkUser = await clerkClient.users.getUser(authId);
      
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;
      const email = clerkUser.emailAddresses[0]?.emailAddress || undefined;
      const image = clerkUser.imageUrl || undefined;
      const createdAt = clerkUser.createdAt;

      // Update or create user in Convex
      await ctx.runMutation(api.users.create, {
        authId,
        name,
        email,
        image,
        createdAt,
      });

      console.log(`✅ User ${authId} synced successfully`);
      
      return {
        success: true,
        authId,
        name,
        email,
        createdAt,
      };

    } catch (error) {
      console.error(`❌ Error syncing user ${authId}:`, error);
      throw new Error(`Failed to sync user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
}); 