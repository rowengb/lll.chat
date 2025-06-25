import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { Message } from '../types/chat';
import { LoadingStatus, TimelineStep, TimelineBuilder } from '../components/DynamicLoadingStatus';

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
}

interface GroundingSource {
  title: string; // Domain name (e.g., "pbs.org", "democracynow.org")
  url: string; // Vertexaisearch redirect URL (e.g., "https://vertexaisearch.cloud.google.com/grounding-api-redirect/...")
  snippet?: string;
  confidence?: number; // Confidence percentage (0-100)
  // Unfurled metadata from the actual destination
  unfurled?: {
    title?: string; // Actual article title
    description?: string; // Article description
    image?: string; // Article image
    favicon?: string; // Site favicon
    siteName?: string; // Site name
    finalUrl?: string; // Final URL after redirects
  };
}

interface GroundingMetadata {
  sources?: GroundingSource[]; // The sources used for grounding (optional)
  rawData?: any; // Include raw data for debugging
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
  
  // Dynamic loading status
  loadingStatus: Record<string, LoadingStatus>; // threadId -> status
  loadingTimelines: Record<string, TimelineStep[]>; // threadId -> timeline steps
  timelineBuilders: Record<string, TimelineBuilder>; // threadId -> timeline builder instance
  
  // Transition state for smooth chat switching
  isTransitioning: boolean;
  currentDisplayThreadId: string | null;
  displayMessages: Message[];
  
  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  lastExpandedWidth: number;
  
  // Performance optimizations - Map-based loading states
  loadingStates: Map<string, boolean>;
  streamingStates: Map<string, boolean>;
  
  // Actions
  setMessages: (threadId: string, messages: Message[]) => void;
  addMessage: (threadId: string, message: Message) => void;
  updateStreamingMessage: (threadId: string, messageId: string, updates: Partial<Message>) => void;
  setStreaming: (threadId: string | null, isStreaming: boolean) => void;
  setLoading: (threadId: string | null, isLoading: boolean) => void;
  setLoadingStatus: (threadId: string, status: LoadingStatus | null) => void;
  getTimeline: (threadId: string) => TimelineStep[];
  clearThread: (threadId: string) => void;
  
  // Optimized selectors
  getMessagesCount: (threadId: string) => number;
  getLastMessage: (threadId: string) => Message | undefined;
  
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
  
  // Comprehensive thread cleanup - removes ALL traces of a thread
  deleteThread: (threadId: string) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      messagesByThread: {},
      isStreaming: false,
      streamingThreadId: null,
      isLoading: false,
      loadingThreadId: null,
      loadingStatus: {},
      loadingTimelines: {},
      timelineBuilders: {},
      
      // Transition state
      isTransitioning: false,
      currentDisplayThreadId: null,
      displayMessages: [],
      
      // Default sidebar state
      sidebarCollapsed: false,
      sidebarWidth: 288,
      lastExpandedWidth: 288,
      
      // Performance optimizations
      loadingStates: new Map(),
      streamingStates: new Map(),

      // Optimized message getters
      getMessagesCount: (threadId: string) => {
        return get().messagesByThread[threadId]?.length || 0;
      },

      getLastMessage: (threadId: string) => {
        const messages = get().messagesByThread[threadId];
        return messages?.[messages.length - 1];
      },
  
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
  
  updateStreamingMessage: (threadId: string, messageId: string, updates: Partial<Message>) => {
        set((state) => {
          const messages = state.messagesByThread[threadId] || [];
          const updatedMessages = messages.map((msg) =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
          return {
      messagesByThread: {
        ...state.messagesByThread,
              [threadId]: updatedMessages,
            },
          };
        });
      },

      // Optimized loading state management
      setLoading: (threadId: string | null, isLoading: boolean) => {
        set((state) => {
          const newLoadingStates = new Map(state.loadingStates);
          
          if (threadId) {
            if (isLoading) {
              newLoadingStates.set(threadId, true);
            } else {
              newLoadingStates.delete(threadId);
            }
          } else {
            // Clear all loading states when threadId is null
            newLoadingStates.clear();
          }
          
          return { 
            loadingStates: newLoadingStates,
            isLoading: isLoading && threadId !== null,
            loadingThreadId: isLoading ? threadId : null
          };
        });
      },
      
      setLoadingStatus: (threadId: string, status: LoadingStatus | null) => {
        set((state) => {
          // Check if status actually changed to prevent unnecessary updates
          const currentStatus = state.loadingStatus[threadId];
          if (status && currentStatus && 
              currentStatus.step === status.step && 
              currentStatus.message === status.message &&
              currentStatus.details === status.details) {
            return state; // No change, return current state
          }
          
          const newLoadingStatus = { ...state.loadingStatus };
          const newLoadingTimelines = { ...state.loadingTimelines };
          const newTimelineBuilders = { ...state.timelineBuilders };
          
          if (status) {
            newLoadingStatus[threadId] = status;
            
            // Initialize timeline builder if not exists
            if (!newTimelineBuilders[threadId]) {
              newTimelineBuilders[threadId] = new TimelineBuilder();
            }
            
            // Update timeline only if status actually changed
            const timeline = newTimelineBuilders[threadId].updateStep(status);
            newLoadingTimelines[threadId] = timeline;
          } else {
            delete newLoadingStatus[threadId];
            delete newLoadingTimelines[threadId];
            delete newTimelineBuilders[threadId];
          }
          
          return { 
            loadingStatus: newLoadingStatus,
            loadingTimelines: newLoadingTimelines,
            timelineBuilders: newTimelineBuilders
          };
        });
      },
      
      getTimeline: (threadId: string) => {
        const state = get();
        return state.loadingTimelines[threadId] || EMPTY_TIMELINE;
      },
  
  setStreaming: (threadId: string | null, isStreaming: boolean) => {
        set((state) => {
          const newStreamingStates = new Map(state.streamingStates);
          
          if (threadId) {
            if (isStreaming) {
              newStreamingStates.set(threadId, true);
            } else {
              newStreamingStates.delete(threadId);
            }
          } else {
            // Clear all streaming states when threadId is null
            newStreamingStates.clear();
          }
          
          return {
            streamingStates: newStreamingStates,
            isStreaming: isStreaming && threadId !== null,
            streamingThreadId: isStreaming ? threadId : null
          };
    });
  },
  
  clearThread: (threadId: string) => {
    set((state) => {
      const newMessagesByThread = { ...state.messagesByThread };
      delete newMessagesByThread[threadId];
      return { messagesByThread: newMessagesByThread };
    });
  },
  
  // Comprehensive thread cleanup - removes ALL traces of a thread
  deleteThread: (threadId: string) => {
    set((state) => {
      const newMessagesByThread = { ...state.messagesByThread };
      const newLoadingStatus = { ...state.loadingStatus };
      const newLoadingTimelines = { ...state.loadingTimelines };
      const newTimelineBuilders = { ...state.timelineBuilders };
      const newLoadingStates = new Map(state.loadingStates);
      const newStreamingStates = new Map(state.streamingStates);
      
      // Remove all traces of this thread
      delete newMessagesByThread[threadId];
      delete newLoadingStatus[threadId];
      delete newLoadingTimelines[threadId];
      delete newTimelineBuilders[threadId];
      newLoadingStates.delete(threadId);
      newStreamingStates.delete(threadId);
      
      return {
        messagesByThread: newMessagesByThread,
        loadingStatus: newLoadingStatus,
        loadingTimelines: newLoadingTimelines,
        timelineBuilders: newTimelineBuilders,
        loadingStates: newLoadingStates,
        streamingStates: newStreamingStates,
        // Reset current thread if it was the deleted one
        currentDisplayThreadId: state.currentDisplayThreadId === threadId ? null : state.currentDisplayThreadId,
        displayMessages: state.currentDisplayThreadId === threadId ? [] : state.displayMessages,
        // Reset loading/streaming if it was for this thread
        isLoading: state.loadingThreadId === threadId ? false : state.isLoading,
        loadingThreadId: state.loadingThreadId === threadId ? null : state.loadingThreadId,
        isStreaming: state.streamingThreadId === threadId ? false : state.isStreaming,
        streamingThreadId: state.streamingThreadId === threadId ? null : state.streamingThreadId,
      };
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
    })),
{
  name: 'chat-store',
  partialize: (state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    lastExpandedWidth: state.lastExpandedWidth,
  }),
}
  )
);

// Optimized selectors for components
export const useChatMessages = (threadId: string) => 
  useChatStore((state) => state.messagesByThread[threadId] || []);

export const useChatMessagesCount = (threadId: string) => 
  useChatStore((state) => state.messagesByThread[threadId]?.length || 0);

export const useChatLastMessage = (threadId: string) => 
  useChatStore((state) => {
    const messages = state.messagesByThread[threadId];
    return messages?.[messages.length - 1];
  });

export const useChatLoading = (threadId: string) => 
  useChatStore((state) => state.loadingStates.get(threadId) || false);

export const useChatLoadingStatus = (threadId: string) => 
  useChatStore((state) => state.loadingStatus[threadId]);

// Stable empty array to prevent infinite re-renders
const EMPTY_TIMELINE: TimelineStep[] = [];

export const useChatTimeline = (threadId: string) => 
  useChatStore((state) => state.loadingTimelines[threadId] || EMPTY_TIMELINE);

export const useChatStreaming = (threadId: string) => 
  useChatStore((state) => state.streamingStates.get(threadId) || false);

export const useSidebarState = () => 
  useChatStore((state) => ({
    collapsed: state.sidebarCollapsed,
    width: state.sidebarWidth,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setSidebarWidth: state.setSidebarWidth,
    toggleSidebar: state.toggleSidebar,
  })); 