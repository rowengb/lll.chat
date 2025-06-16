import { trpc } from "@/utils/trpc";

export const useChatData = (threadId: string | null) => {
  // Queries
  const { data: serverMessages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { threadId: threadId || "" },
    { 
      enabled: !!threadId && typeof threadId === "string",
      refetchOnWindowFocus: false,
      retry: false
    }
  );

  const { data: allModels } = trpc.models.getModels.useQuery();
  const { data: favoriteModels } = trpc.models.getFavoriteModels.useQuery();
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery();
  const { data: threads, refetch: refetchThreads } = trpc.chat.getThreads.useQuery();
  const { data: hasAnyApiKeys } = trpc.apiKeys.hasAnyApiKeys.useQuery();

  // Mutations
  const createThread = trpc.chat.createThread.useMutation();
  const updateThreadMetadata = trpc.chat.updateThreadMetadata.useMutation();
  const generateTitle = trpc.chat.generateTitle.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const saveStreamedMessage = trpc.chat.saveStreamedMessage.useMutation();
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
    // Queries
    serverMessages,
    refetchMessages,
    allModels,
    favoriteModels,
    bestDefaultModel,
    threads,
    refetchThreads,
    hasAnyApiKeys,
    
    // Mutations
    createThread,
    updateThreadMetadata,
    generateTitle,
    sendMessage,
    saveStreamedMessage,
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