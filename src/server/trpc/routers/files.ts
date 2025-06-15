import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Helper function to get or create Convex user
const getOrCreateConvexUser = async (authUserId: string) => {
  // First try to find existing user
  const existingUser = await convex.query(api.users.getByAuthId, {
    authId: authUserId,
  });

  if (existingUser) {
    return existingUser;
  }

  // Create new user if not found
  await convex.mutation(api.users.create, {
    authId: authUserId,
  });

  // Get the newly created user
  return await convex.query(api.users.getByAuthId, {
    authId: authUserId,
  });
};

export const filesRouter = createTRPCRouter({
  generateUploadUrl: protectedProcedure
    .mutation(async () => {
      return await convex.mutation(api.files.generateUploadUrl, {});
    }),

  createFile: protectedProcedure
    .input(z.object({
      name: z.string(),
      type: z.string(),
      size: z.number(),
      storageId: z.string(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      return await convex.mutation(api.files.createFile, {
        name: input.name,
        type: input.type,
        size: input.size,
        storageId: input.storageId as Id<"_storage">,
        userId: convexUser._id,
        messageId: input.messageId ? input.messageId as Id<"messages"> : undefined,
        threadId: input.threadId ? input.threadId as Id<"threads"> : undefined,
      });
    }),

  saveImageFromUrl: protectedProcedure
    .input(z.object({
      imageUrl: z.string(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const convexUser = await getOrCreateConvexUser(ctx.userId);
        if (!convexUser) {
          throw new Error("Failed to get or create user");
        }

        // Download the image
        const response = await fetch(input.imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const imageBlob = await response.blob();
        
        // Generate upload URL
        const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
        
        // Upload the image to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'image/png',
          },
          body: imageBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
        }

        const { storageId } = await uploadResponse.json();

        // Create file record
        const fileName = `generated-image-${Date.now()}.png`;
        const fileId = await convex.mutation(api.files.createFile, {
          name: fileName,
          type: 'image/png',
          size: imageBlob.size,
          storageId: storageId as Id<"_storage">,
          userId: convexUser._id,
          messageId: input.messageId ? input.messageId as Id<"messages"> : undefined,
          threadId: input.threadId ? input.threadId as Id<"threads"> : undefined,
        });

        return fileId;
      } catch (error) {
        console.error("Failed to save image from URL:", error);
        throw new Error("Failed to save image to storage");
      }
    }),

  getFile: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.files.getFile, {
        fileId: input.fileId as Id<"files">,
      });
    }),

  getFilesByMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.files.getFilesByMessage, {
        messageId: input.messageId as Id<"messages">,
      });
    }),

  getFilesByThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ input }) => {
      return await convex.query(api.files.getFilesByThread, {
        threadId: input.threadId as Id<"threads">,
      });
    }),

  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ input }) => {
      return await convex.mutation(api.files.deleteFile, {
        fileId: input.fileId as Id<"files">,
      });
    }),

  getFilesByUser: protectedProcedure
    .query(async ({ ctx }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      return await convex.query(api.files.getFilesByUser, {
        userId: convexUser._id,
      });
    }),

  updateFileAssociations: protectedProcedure
    .input(z.object({
      fileIds: z.array(z.string()),
      messageId: z.string(),
      threadId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await convex.mutation(api.files.updateFileAssociations, {
        fileIds: input.fileIds.map(id => id as Id<"files">),
        messageId: input.messageId as Id<"messages">,
        threadId: input.threadId as Id<"threads">,
      });
    }),
}); 