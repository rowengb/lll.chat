import { Message, FileAttachmentData } from "../types/chat";

export const filterOutEmptyOptimisticMessages = (messages: Message[]) => {
  return messages.filter(message => 
    // Filter out empty optimistic assistant messages
    !(message.isOptimistic && message.role === "assistant" && !message.content.trim())
  );
};

export const createOptimisticUserMessage = (content: string, attachments?: FileAttachmentData[]): Message => {
  return {
    id: `temp-user-${Date.now()}`,
    content,
    role: "user",
    createdAt: new Date(),
    isOptimistic: true,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };
};

export const createOptimisticAssistantMessage = (): Message => {
  return {
    id: `temp-assistant-${Date.now()}`,
    content: "",
    role: "assistant",
    createdAt: new Date(),
    isOptimistic: true,
  };
};

export const removeErrorMessages = (messages: Message[]): Message[] => {
  return messages.filter(msg => !msg.isError);
};

export const removeOptimisticMessages = (messages: Message[]): Message[] => {
  return messages.filter(msg => !msg.isOptimistic);
};

export const mapFileAttachments = (files: any[]): FileAttachmentData[] => {
  return files.map(file => ({
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    url: file.url,
    storageId: file.storageId
  }));
};

export const prepareMessagesForStreaming = (messages: Message[]): Array<{role: string, content: string}> => {
  return messages
    .filter(msg => !msg.isOptimistic && !msg.isError)
    .map(msg => ({ role: msg.role, content: msg.content }));
}; 