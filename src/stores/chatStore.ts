import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Message {
  id: string;
  content: string;
  role: string;
  model?: string | null;
  createdAt: Date;
  isOptimistic?: boolean;
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
  
  // Sidebar actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  
  // Get messages for a thread
  getMessages: (threadId: string) => Message[];
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messagesByThread: {},
      isStreaming: false,
      streamingThreadId: null,
      isLoading: false,
      loadingThreadId: null,
      
      // Default sidebar state
      sidebarCollapsed: false,
      sidebarWidth: 288,
      lastExpandedWidth: 288,
  
  setMessages: (threadId: string, messages: Message[]) => {
    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [threadId]: messages,
      },
    }));
  },
  
  addMessage: (threadId: string, message: Message) => {
    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [threadId]: [...(state.messagesByThread[threadId] || []), message],
      },
    }));
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