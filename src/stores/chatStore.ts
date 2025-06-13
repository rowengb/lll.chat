import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
}

interface Message {
  id: string;
  content: string;
  role: string;
  model?: string | null;
  createdAt: Date;
  isOptimistic?: boolean;
  attachments?: FileAttachment[];
}

interface ChatStore {
  // Messages by thread ID
  messagesByThread: Record<string, Message[]>;
  
  // Current streaming state
  isStreaming: boolean;
  streamingThreadId: string | null;
  
  // Loading state
  isLoading: boolean;
  loadingThreadId: string | null;
  
  // Transition state for smooth chat switching
  isTransitioning: boolean;
  currentDisplayThreadId: string | null;
  displayMessages: Message[];
  
  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  lastExpandedWidth: number;
  
  // Actions
  setMessages: (threadId: string, messages: Message[]) => void;
  addMessage: (threadId: string, message: Message) => void;
  updateStreamingMessage: (threadId: string, messageId: string, content: string) => void;
  setStreaming: (threadId: string | null, isStreaming: boolean) => void;
  setLoading: (threadId: string | null, isLoading: boolean) => void;
  clearThread: (threadId: string) => void;
  
  // Transition actions
  startThreadTransition: (newThreadId: string | null) => void;
  endThreadTransition: (threadId: string) => void;
  
  // Sidebar actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  
  // Get messages for a thread
  getMessages: (threadId: string) => Message[];
  getDisplayMessages: () => Message[];
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messagesByThread: {},
      isStreaming: false,
      streamingThreadId: null,
      isLoading: false,
      loadingThreadId: null,
      
      // Transition state
      isTransitioning: false,
      currentDisplayThreadId: null,
      displayMessages: [],
      
      // Default sidebar state
      sidebarCollapsed: false,
      sidebarWidth: 288,
      lastExpandedWidth: 288,
  
  setMessages: (threadId: string, messages: Message[]) => {
    set((state) => {
      const newState = {
        messagesByThread: {
          ...state.messagesByThread,
          [threadId]: messages,
        },
      };
      
      // Update display messages if this is the current display thread and not transitioning
      if (!state.isTransitioning && state.currentDisplayThreadId === threadId) {
        (newState as any).displayMessages = messages;
      }
      
      return newState;
    });
  },
  
  addMessage: (threadId: string, message: Message) => {
    set((state) => {
      const newMessages = [...(state.messagesByThread[threadId] || []), message];
      const newState = {
        messagesByThread: {
          ...state.messagesByThread,
          [threadId]: newMessages,
        },
      };
      
      // Update display messages if this is the current display thread and not transitioning
      if (!state.isTransitioning && state.currentDisplayThreadId === threadId) {
        (newState as any).displayMessages = newMessages;
      }
      
      return newState;
    });
  },
  
  updateStreamingMessage: (threadId: string, messageId: string, content: string) => {
    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [threadId]: (state.messagesByThread[threadId] || []).map(msg =>
          msg.id === messageId ? { ...msg, content } : msg
        ),
      },
    }));
  },
  
  setStreaming: (threadId: string | null, isStreaming: boolean) => {
    set({
      isStreaming,
      streamingThreadId: threadId,
    });
  },
  
  setLoading: (threadId: string | null, isLoading: boolean) => {
    set({
      isLoading,
      loadingThreadId: threadId,
    });
  },
  
  clearThread: (threadId: string) => {
    set((state) => {
      const newMessagesByThread = { ...state.messagesByThread };
      delete newMessagesByThread[threadId];
      return { messagesByThread: newMessagesByThread };
    });
  },
  
  getMessages: (threadId: string) => {
    return get().messagesByThread[threadId] || [];
  },
  
  getDisplayMessages: () => {
    return get().displayMessages;
  },
  
  startThreadTransition: (newThreadId: string | null) => {
    set({
      isTransitioning: true,
      currentDisplayThreadId: newThreadId,
      displayMessages: [], // Clear display during transition
    });
  },
  
  endThreadTransition: (threadId: string) => {
    const state = get();
    const messages = state.messagesByThread[threadId] || [];
    set({
      isTransitioning: false,
      currentDisplayThreadId: threadId,
      displayMessages: messages,
    });
  },
  
  // Sidebar actions
  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },
  
  setSidebarWidth: (width: number) => {
    set((state) => {
      const newState = { sidebarWidth: width };
      
      // If sidebar is not collapsed and width > 0, update lastExpandedWidth
      if (!state.sidebarCollapsed && width > 0) {
        (newState as any).lastExpandedWidth = width;
      }
      
      return newState;
    });
  },
  
  toggleSidebar: () => {
    set((state) => {
      const newCollapsed = !state.sidebarCollapsed;
      const newWidth = newCollapsed ? 0 : state.lastExpandedWidth;
      
      return {
        sidebarCollapsed: newCollapsed,
        sidebarWidth: newWidth,
      };
    });
  },
}),
{
  name: 'chat-store',
  partialize: (state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    lastExpandedWidth: state.lastExpandedWidth,
  }),
}
)); 