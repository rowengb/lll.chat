import { trpc } from "@/utils/trpc";
import { useMemo } from "react";

export const useChatData = (threadId: string | null) => {
  // Optimized queries with aggressive caching and selective updates
  const { data: serverMessages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { threadId: threadId || "" },
    { 
      enabled: !!threadId && typeof threadId === "string",
      refetchOnWindowFocus: false,
      retry: false,
      // Aggressive caching for messages - they rarely change once loaded
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      // Only refetch if threadId actually changes
      refetchOnMount: false,
    }
  );

  // Core data with optimized caching strategies
  const { data: allModels } = trpc.models.getModels.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes - models rarely change
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  
  const { data: favoriteModels } = trpc.models.getFavoriteModels.useQuery(undefined, {
    staleTime: 2 * 60 * 1000, // 2 minutes - favorites change more often
    cacheTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  
  const { data: threads, refetch: refetchThreads } = trpc.chat.getThreads.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds - threads change frequently
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  
  const { data: hasAnyApiKeys } = trpc.apiKeys.hasAnyApiKeys.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes - API keys rarely change
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Memoized computed values to prevent unnecessary recalculations
  const optimizedData = useMemo(() => {
    return {
      serverMessages,
      allModels,
      favoriteModels,
      bestDefaultModel,
      threads,
      hasAnyApiKeys,
    };
  }, [serverMessages, allModels, favoriteModels, bestDefaultModel, threads, hasAnyApiKeys]);

  // Mutations with optimistic updates
  const createThread = trpc.chat.createThread.useMutation();
  const updateThreadMetadata = trpc.chat.updateThreadMetadata.useMutation();
  const generateTitle = trpc.chat.generateTitle.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const saveStreamedMessage = trpc.chat.saveStreamedMessage.useMutation();
  const saveUserMessage = trpc.chat.saveUserMessage.useMutation();
  const saveErrorMessage = trpc.chat.saveErrorMessage.useMutation();
  const deleteMessage = trpc.chat.deleteMessage.useMutation();
  const deleteMessagesFromPoint = trpc.chat.deleteMessagesFromPoint.useMutation();
  const saveAssistantMessage = trpc.chat.saveAssistantMessage.useMutation();
  const createManyMessages = trpc.chat.createManyMessages.useMutation();
  const updateFileAssociations = trpc.files.updateFileAssociations.useMutation();
  const duplicateFilesForThread = trpc.files.duplicateFilesForThread.useMutation();
  const updateMessageFileAssociations = trpc.chat.updateMessageFileAssociations.useMutation();

  // Utilities
  const utils = trpc.useUtils();

  return {
    // Optimized data
    ...optimizedData,
    refetchMessages,
    refetchThreads,
    
    // Mutations
    createThread,
    updateThreadMetadata,
    generateTitle,
    sendMessage,
    saveStreamedMessage,
    saveUserMessage,
    saveErrorMessage,
    deleteMessage,
    deleteMessagesFromPoint,
    saveAssistantMessage,
    createManyMessages,
    updateFileAssociations,
    duplicateFilesForThread,
    updateMessageFileAssociations,
    
    // Utilities
    utils
  };
}; 