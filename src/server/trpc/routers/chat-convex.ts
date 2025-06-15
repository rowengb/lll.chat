import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getAiClient } from "@/server/ai/client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import CryptoJS from "crypto-js";

// Initialize Convex client for server-side operations
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Helper functions
const getModelProvider = async (modelId?: string) => {
  if (!modelId) {
    // Get default model from database
    const defaultModel = await convex.query(api.models.getFavoriteModels);
    const firstFavorite = defaultModel[0];
    if (firstFavorite) {
      return { 
        provider: firstFavorite.provider, 
        model: firstFavorite.id,
        apiUrl: firstFavorite.apiUrl 
      };
    }
    return { provider: "openai", model: "gpt-3.5-turbo", apiUrl: "https://api.openai.com/v1/chat/completions" };
  }
  
  // Get model from database
  const modelData = await convex.query(api.models.getModelById, { modelId });
  if (modelData) {
    return { 
      provider: modelData.provider, 
      model: modelData.id,
      apiUrl: modelData.apiUrl 
    };
  }
  
  // Fallback to OpenAI if model not found
  return { provider: "openai", model: modelId, apiUrl: "https://api.openai.com/v1/chat/completions" };
};

const getApiKeyForProvider = async (provider: string, userId: Id<"users">) => {
  const apiKey = await convex.query(api.apiKeys.getByUserAndProvider, {
    userId,
    provider,
  });
  return apiKey?.keyValue;
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

export const chatConvexRouter = createTRPCRouter({
  getThreads: protectedProcedure.query(async ({ ctx }) => {
    const convexUser = await getOrCreateConvexUser(ctx.userId);

    if (!convexUser) {
      throw new Error("Failed to get or create user");
    }

    const threads = await convex.query(api.threads.getByUser, {
      userId: convexUser._id,
    });

    // Get the last model for each thread
    const threadsWithModels = await Promise.all(
      threads.map(async (thread) => {
        const messages = await convex.query(api.messages.getByThread, {
          threadId: thread._id,
        });
        
        const lastAssistantMessage = messages
          .filter(m => m.role === "assistant" && m.model)
          .pop();
        
        return {
          ...thread,
          id: thread._id,
          model: thread.lastModel || lastAssistantMessage?.model || null,
          branchedFromThreadId: thread.branchedFromThreadId,
        };
      })
    );

    return threadsWithModels;
  }),

  createThread: protectedProcedure
    .input(z.object({ 
      title: z.string().optional(),
      model: z.string().optional(),
      branchedFromThreadId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const threadId = await convex.mutation(api.threads.create, {
        userId: convexUser._id,
        title: input.title,
        lastModel: input.model,
        branchedFromThreadId: input.branchedFromThreadId ? input.branchedFromThreadId as Id<"threads"> : undefined,
      });

      return { id: threadId, title: input.title, lastModel: input.model };
    }),

  getMessages: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Return empty array if threadId is empty (during transitions)
      if (!input.threadId || input.threadId.trim() === "") {
        return [];
      }

      const messages = await convex.query(api.messages.getByThread, {
        threadId: input.threadId as Id<"threads">,
      });

      return messages.map(msg => ({
        ...msg,
        id: msg._id,
        threadId: msg.threadId,
      }));
    }),

  saveStreamedMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      userContent: z.string(),
      assistantContent: z.string(),
      model: z.string().optional(),
      userAttachments: z.array(z.string()).optional(), // Array of file IDs
      isGrounded: z.boolean().optional(),
      groundingSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
        confidence: z.number().optional(),
      })).optional(),
      imageFileId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      // Save both messages
      const messages = await convex.mutation(api.messages.createMany, {
        messages: [
          {
            content: input.userContent,
            role: "user",
            threadId: input.threadId as Id<"threads">,
            userId: convexUser._id,
            attachments: input.userAttachments?.map(id => id as Id<"files">),
          },
          {
            content: input.assistantContent,
            role: "assistant",
            model: input.model,
            threadId: input.threadId as Id<"threads">,
            userId: convexUser._id,
            isGrounded: input.isGrounded,
            groundingSources: input.groundingSources,
            imageFileId: input.imageFileId ? input.imageFileId as Id<"files"> : undefined,
          },
        ],
      });

      return { 
        userMessage: {
          id: messages[0],
          content: input.userContent,
          role: "user",
        },
        assistantMessage: {
          id: messages[1],
          content: input.assistantContent,
          role: "assistant",
          model: input.model,
          isGrounded: input.isGrounded,
        },
      };
    }),

  saveAssistantMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      content: z.string(),
      model: z.string().optional(),
      isGrounded: z.boolean().optional(),
      groundingSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
        confidence: z.number().optional(),
      })).optional(),
      imageFileId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const messageId = await convex.mutation(api.messages.createMessage, {
        content: input.content,
        role: "assistant",
        model: input.model,
        threadId: input.threadId as Id<"threads">,
        userId: convexUser._id,
        isGrounded: input.isGrounded,
        groundingSources: input.groundingSources,
        imageFileId: input.imageFileId ? input.imageFileId as Id<"files"> : undefined,
      });

      return { 
        id: messageId,
        content: input.content,
        role: "assistant",
        model: input.model,
        isGrounded: input.isGrounded,
      };
    }),

  updateThreadMetadata: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      lastModel: z.string().optional(),
      estimatedCost: z.number().optional(),
      totalTokens: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await convex.mutation(api.threads.update, {
        id: input.threadId as Id<"threads">,
        lastModel: input.lastModel,
        estimatedCost: input.estimatedCost,
        totalTokens: input.totalTokens,
      });

      return { success: true };
    }),

  deleteThread: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      await convex.mutation(api.threads.deleteThread, {
        id: input.id as Id<"threads">,
        userId: convexUser._id,
      });

      return { success: true };
    }),

  updateThread: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      pinned: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await convex.mutation(api.threads.update, {
        id: input.id as Id<"threads">,
        title: input.title,
        pinned: input.pinned,
      });

      return { success: true };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      content: z.string(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      // Save the user message
      const messageId = await convex.mutation(api.messages.createMessage, {
        content: input.content,
        role: "user",
        threadId: input.threadId as Id<"threads">,
        userId: convexUser._id,
      });

      return { 
        id: messageId,
        content: input.content,
        role: "user",
        threadId: input.threadId,
      };
    }),

  generateTitle: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      firstMessage: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      // Get the user's OpenAI API key
      const apiKeyRecord = await convex.query(api.apiKeys.getByUserAndProvider, {
        userId: convexUser._id,
        provider: "openai",
      });

      if (!apiKeyRecord?.keyValue) {
        return { success: false, error: "OpenAI API key not found" };
      }

      // Decrypt the API key (assuming it's encrypted)
      const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";
      
      let apiKey: string;
      try {
        const bytes = CryptoJS.AES.decrypt(apiKeyRecord.keyValue, ENCRYPTION_SECRET);
        apiKey = bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error("Error decrypting API key:", error);
        return { success: false, error: "Failed to decrypt API key" };
      }

      // Generate the title using Convex function
      const result = await convex.action(api.threads.generateTitle, {
        threadId: input.threadId as Id<"threads">,
        firstMessage: input.firstMessage,
        apiKey: apiKey,
      });

      return result;
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      await convex.mutation(api.messages.deleteMessage, {
        messageId: input.messageId as Id<"messages">,
      });

      return { success: true };
    }),

  deleteMessagesFromPoint: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      fromMessageId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const result = await convex.mutation(api.messages.deleteMessagesFromPoint, {
        threadId: input.threadId as Id<"threads">,
        fromMessageId: input.fromMessageId as Id<"messages">,
      });

      return result;
    }),

  createManyMessages: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      messages: z.array(z.object({
        content: z.string(),
        role: z.string(),
        model: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const messages = await convex.mutation(api.messages.createMany, {
        messages: input.messages.map(msg => ({
          content: msg.content,
          role: msg.role,
          model: msg.model,
          threadId: input.threadId as Id<"threads">,
          userId: convexUser._id,
        })),
      });

      return { 
        messageIds: messages,
        count: messages.length 
      };
    }),

  updateGroundingSourceUnfurl: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      sourceIndex: z.number(),
      unfurledData: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        image: z.string().optional(),
        favicon: z.string().optional(),
        siteName: z.string().optional(),
        finalUrl: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const result = await convex.mutation(api.messages.updateGroundingSourceUnfurl, {
        messageId: input.messageId as Id<"messages">,
        sourceIndex: input.sourceIndex,
        userId: convexUser._id,
        unfurledData: input.unfurledData,
      });

      return result;
    }),

  cleanupOldGroundingFields: protectedProcedure
    .mutation(async ({ ctx }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const result = await convex.mutation(api.messages.cleanupOldGroundingFields, {});

      return result;
    }),
}); 