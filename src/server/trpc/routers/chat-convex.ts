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
        isError: msg.isError || false,
        rawErrorData: msg.rawErrorData,
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
      searchProvider: z.string().optional(),
      groundingSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
        confidence: z.number().optional(),
      })).optional(),
      imageUrl: z.string().optional(),
      imageData: z.string().optional(),
      stoppedByUser: z.boolean().optional(),
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
            searchProvider: input.searchProvider,
            groundingSources: input.groundingSources,
            imageUrl: input.imageUrl,
            imageData: input.imageData,
            stoppedByUser: input.stoppedByUser,
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

  saveUserMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      content: z.string(),
      attachments: z.array(z.string()).optional(), // Array of file IDs
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const messageId = await convex.mutation(api.messages.createMessage, {
        content: input.content,
        role: "user",
        threadId: input.threadId as Id<"threads">,
        userId: convexUser._id,
        attachments: input.attachments?.map(id => id as Id<"files">),
      });

      return { 
        id: messageId,
        content: input.content,
        role: "user",
      };
    }),

  saveErrorMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      content: z.string(),
      rawErrorData: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const messageId = await convex.mutation(api.messages.createMessage, {
        content: input.content,
        role: "assistant",
        threadId: input.threadId as Id<"threads">,
        userId: convexUser._id,
        isError: true,
        rawErrorData: input.rawErrorData,
      });

      return { 
        id: messageId,
        content: input.content,
        role: "assistant",
        isError: true,
        rawErrorData: input.rawErrorData,
      };
    }),

  saveAssistantMessage: protectedProcedure
    .input(z.object({ 
      threadId: z.string(),
      content: z.string(),
      model: z.string().optional(),
      isGrounded: z.boolean().optional(),
      searchProvider: z.string().optional(),
      groundingSources: z.array(z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
        confidence: z.number().optional(),
      })).optional(),
      imageUrl: z.string().optional(),
      imageData: z.string().optional(),
      stoppedByUser: z.boolean().optional(),
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
        searchProvider: input.searchProvider,
        groundingSources: input.groundingSources,
        imageUrl: input.imageUrl,
        imageData: input.imageData,
        stoppedByUser: input.stoppedByUser,
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

      // Get user preferences to check for title generation model
      const preferences = await convex.query(api.users.getPreferences, {
        userId: convexUser._id,
      });

      const titleGenerationModel = preferences?.titleGenerationModel || "gpt-4o-mini";

      // Get model data from database to check for OpenRouter model ID
      const modelFromDb = await convex.query(api.models.getModelById, { modelId: titleGenerationModel });
      
      // Determine provider from model
      const modelData = await getModelProvider(titleGenerationModel);
      
      const useOpenRouterMode = preferences?.useOpenRouter ?? false;
      
      let apiKeyRecord: any = null;
      let actualProvider = modelData.provider;
      let actualModelId = titleGenerationModel;
      
      if (useOpenRouterMode) {
        // In OpenRouter mode, use OpenRouter API key
        apiKeyRecord = await convex.query(api.apiKeys.getByUserAndProvider, {
          userId: convexUser._id,
          provider: "openrouter",
        });
        
        if (apiKeyRecord?.keyValue) {
          actualProvider = "openrouter";
          // Use OpenRouter model ID if available, otherwise use original model ID
          if (modelFromDb?.openrouterModelId) {
            actualModelId = modelFromDb.openrouterModelId;
          }
        } else {
          return { success: false, error: "OpenRouter mode is enabled but no OpenRouter API key found. Please add an OpenRouter API key in Settings." };
        }
      } else {
        // In individual provider mode, use specific provider API key
        apiKeyRecord = await convex.query(api.apiKeys.getByUserAndProvider, {
          userId: convexUser._id,
          provider: modelData.provider,
        });
        
        if (!apiKeyRecord?.keyValue) {
          return { success: false, error: `No API key found for ${modelData.provider}. Please add a ${modelData.provider} API key in Settings or switch to OpenRouter mode.` };
        }
      }

      // Decrypt the API key
      const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";
      
      let apiKey: string;
      try {
        const bytes = CryptoJS.AES.decrypt(apiKeyRecord.keyValue, ENCRYPTION_SECRET);
        apiKey = bytes.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error("Error decrypting API key:", error);
        return { success: false, error: "Failed to decrypt API key" };
      }

      // Generate the title using Convex function with the correct provider and model
      const result = await convex.action(api.threads.generateTitle, {
        threadId: input.threadId as Id<"threads">,
        firstMessage: input.firstMessage,
        apiKey: apiKey,
        modelId: actualModelId,
        provider: actualProvider,
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
        attachments: z.array(z.string()).optional(),
        isGrounded: z.boolean().optional(),
        groundingSources: z.array(z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string().optional(),
          confidence: z.number().optional(),
        })).optional(),
        imageUrl: z.string().optional(),
        imageData: z.string().optional(),
        stoppedByUser: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const messages = await convex.mutation(api.messages.createMany, {
        messages: input.messages.map(msg => ({
          ...msg,
          threadId: input.threadId as Id<"threads">,
          userId: convexUser._id,
          attachments: msg.attachments?.map(id => id as Id<"files">),
        })),
      });

      return messages;
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

  batchUpdateGroundingSourceUnfurl: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      unfurls: z.array(z.object({
        sourceIndex: z.number(),
        unfurledData: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          image: z.string().optional(),
          favicon: z.string().optional(),
          siteName: z.string().optional(),
          finalUrl: z.string().optional(),
        }),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      const result = await convex.mutation(api.messages.batchUpdateGroundingSourceUnfurl, {
        messageId: input.messageId as Id<"messages">,
        userId: convexUser._id,
        unfurls: input.unfurls,
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

  updateMessageImageFile: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      imageFileId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const convexUser = await getOrCreateConvexUser(ctx.userId);

      if (!convexUser) {
        throw new Error("Failed to get or create user");
      }

      await convex.mutation(api.messages.updateMessageImageFile, {
        messageId: input.messageId as Id<"messages">,
        imageFileId: input.imageFileId as Id<"files">,
      });

      return { success: true };
    }),

  updateMessageFileAssociations: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      attachments: z.array(z.string()).optional(),
      imageFileId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await convex.mutation(api.messages.updateMessageFileAssociations, {
        messageId: input.messageId as Id<"messages">,
        attachments: input.attachments?.map(id => id as Id<"files">),
        imageFileId: input.imageFileId ? input.imageFileId as Id<"files"> : undefined,
      });
    }),
}); 