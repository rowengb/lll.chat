import { useState, useRef, useEffect } from "react";
import { PlusIcon, MessageSquareIcon, SettingsIcon, ChevronLeftIcon, MenuIcon, SearchIcon, TrashIcon, PinIcon, MoreVerticalIcon, EditIcon, Waves, UserIcon, LogOutIcon, GitBranchIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";
import { getProviderIcon } from "./ModelSelector";
import toast from "react-hot-toast";
import Logo from './Logo';
import { useChatStore } from "../stores/chatStore";


// Helper function to get provider from model name using database
const getProviderFromModel = (modelId?: string | null, models?: any[]) => {
  if (!modelId || !models) return "openai";
  
  const modelData = models.find(m => m.id === modelId);
  return modelData?.provider || "openai";
};

const getModelNameFromId = (modelId?: string | null, models?: any[]) => {
  if (!modelId || !models) return undefined;
  
  const modelData = models.find(m => m.id === modelId);
  return modelData?.name;
};

interface SidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewChat?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAccount?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onWidthChange?: (width: number) => void;
}

interface ContextMenu {
  threadId: string;
  x: number;
  y: number;
}

export function Sidebar({ currentThreadId, onThreadSelect, onNewChat, onNavigateToSettings, onNavigateToAccount, collapsed, onToggleCollapse, onWidthChange }: SidebarProps) {
  const router = useRouter();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 18rem = 288px
  const [isResizing, setIsResizing] = useState(false);
  
  const [hoverAnimationsDisabled, setHoverAnimationsDisabled] = useState(false);
  
  // Helper function to temporarily disable hover animations after pin/unpin actions
  // This prevents jittery animations when threads move and mouse ends up over different thread
  const temporarilyDisableHoverAnimations = () => {
    setHoverAnimationsDisabled(true);
    setTimeout(() => {
      setHoverAnimationsDisabled(false);
    }, 300); // Longer delay to prevent jittery animations after DOM changes
  };

  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  const utils = trpc.useUtils();
  const { data: threads, refetch: refetchThreads } = trpc.chat.getThreads.useQuery(undefined, {
    // Automatically refetch when window regains focus, but with a delay to avoid jittery behavior
    refetchOnWindowFocus: true,
    // Stale time of 5 seconds - data is considered fresh for 5 seconds
    staleTime: 5000,
    // Refetch in background every 30 seconds when data is stale
    refetchInterval: 30000,
  });
  const { data: models } = trpc.models.getModels.useQuery();
  const { data: favoriteModels } = trpc.models.getFavoriteModels.useQuery();
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery();
  
  // Get default model using user preferences and API key validation
  const getDefaultModel = () => {
    if (bestDefaultModel?.modelId) {
      return bestDefaultModel.modelId;
    }
    // Fallback to first favorite model if available
    if (favoriteModels && favoriteModels.length > 0) {
      return favoriteModels[0]?.id || 'gpt-4o';
    }
    return "gpt-4o"; // Final fallback
  };

  const createThread = trpc.chat.createThread.useMutation({
    onSuccess: (newThread) => {
      // Invalidate and refetch threads to update the UI
      utils.chat.getThreads.invalidate();
      onThreadSelect(newThread.id);
    },
    onError: () => {
      toast.dismiss();
      toast.error("Failed to create new conversation");
    },
  });

  const deleteThread = trpc.chat.deleteThread.useMutation({
    onSuccess: () => {
      // Invalidate and refetch threads to update the UI
      utils.chat.getThreads.invalidate();
      
      if (currentThreadId && threads?.find(t => t.id === currentThreadId)) {
        // If current thread was deleted, redirect to app welcome
        router.push("/app");
      }
    },
    onError: () => {
      toast.dismiss();
      toast.error("Failed to delete conversation");
    },
  });

  const updateThread = trpc.chat.updateThread.useMutation({
    onMutate: async (newData) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await utils.chat.getThreads.cancel();

      // Snapshot the previous value
      const previousThreads = utils.chat.getThreads.getData();

      // Optimistically update to the new value
      utils.chat.getThreads.setData(undefined, (old) => {
        if (!old) return old;
        
        return old.map(thread => 
          thread.id === newData.id 
            ? { 
                ...thread, 
                title: newData.title !== undefined ? newData.title : thread.title,
                pinned: newData.pinned !== undefined ? newData.pinned : thread.pinned
              }
            : thread
        );
      });

      // Return a context object with the snapshotted value
      return { previousThreads };
    },
    onError: (err, newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousThreads) {
        utils.chat.getThreads.setData(undefined, context.previousThreads);
      }
      toast.dismiss();
      toast.error("Failed to update conversation");
    },
    // Remove onSettled to avoid unnecessary refetch since we have optimistic updates
  });

  // Handle floating buttons delay
  useEffect(() => {
    if (collapsed) {
      // When collapsing, show floating buttons after a short delay
      const timer = setTimeout(() => {
        setShowFloatingButtons(true);
      }, 200); // Reduced delay for quicker appearance
      
      return () => clearTimeout(timer);
    } else {
      // When expanding, hide floating buttons immediately
      setShowFloatingButtons(false);
    }
  }, [collapsed]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(240, Math.min(600, e.clientX)); // Min 240px, Max 600px
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  // Notify parent component when sidebar width changes during resizing
  useEffect(() => {
    if (!collapsed) {
      onWidthChange?.(sidebarWidth);
    }
  }, [sidebarWidth, collapsed, onWidthChange]);

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Fallback to router navigation if no prop provided
      router.push("/app");
    }
  };

  const handleNewChatCollapsed = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Fallback to router navigation if no prop provided
      router.push("/app");
    }
  };

  const handleDeleteThread = (threadId: string) => {
    // Prevent multiple calls while mutation is in progress
    if (deleteThread.isLoading) return;
    
    deleteThread.mutate({ id: threadId });
    setContextMenu(null);
    toast.dismiss();
    toast.success("Conversation deleted");
  };

  const handlePinThread = (threadId: string) => {
    // Prevent multiple calls while mutation is in progress or if already processing this thread
    if (updateThread.isLoading) return;
    
    const thread = threads?.find(t => t.id === threadId);
    if (!thread) return;
    
    const isCurrentlyPinned = (thread as any).pinned;
    
    // Use mutateAsync to prevent duplicate calls
    updateThread.mutateAsync({
      id: threadId,
      pinned: !isCurrentlyPinned,
    }).then(() => {
      // Success toast only after mutation completes
      toast.dismiss();
      toast.success(isCurrentlyPinned ? "Conversation unpinned" : "Conversation pinned");
    }).catch(() => {
      // Error is already handled in onError
    });
    
    setContextMenu(null);
    temporarilyDisableHoverAnimations(); // Prevent jittery animations when threads reorder
  };

  const handleRenameStart = (threadId: string, currentTitle: string) => {
    setEditingThread(threadId);
    setEditTitle(currentTitle || `Chat ${threadId.slice(0, 8)}`);
    setContextMenu(null);
  };

  const handleRenameSubmit = (threadId: string) => {
    if (editTitle.trim()) {
      updateThread.mutate({
        id: threadId,
        title: editTitle.trim(),
      });
      toast.dismiss();
      toast.success("Conversation renamed");
    }
    setEditingThread(null);
  };

  const handleRenameCancel = () => {
    setEditingThread(null);
    setEditTitle("");
  };

  const handleRightClick = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    setContextMenu({
      threadId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Filter threads based on search query
  const filteredThreads = threads?.filter(thread =>
    thread.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Separate pinned and unpinned threads
  const pinnedThreads = filteredThreads.filter(thread => (thread as any).pinned);
  const unpinnedThreads = filteredThreads.filter(thread => !(thread as any).pinned);

  // Sort each category by creation date (newest first)
  const sortedPinnedThreads = [...pinnedThreads].sort((a, b) => 
    (b as any)._creationTime - (a as any)._creationTime
  );
  const sortedUnpinnedThreads = [...unpinnedThreads].sort((a, b) => 
    (b as any)._creationTime - (a as any)._creationTime
  );

  const ThreadItem = ({ thread, isPinned }: { thread: any; isPinned: boolean }) => {
    const provider = getProviderFromModel(thread.model, models);
    const modelName = getModelNameFromId(thread.model, models);
    const isEditing = editingThread === thread.id;
    const [hasAnimated, setHasAnimated] = useState(false);
    
    return (
      <div
        className={`group relative flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-gray-200 cursor-pointer ${
          currentThreadId === thread.id ? "bg-gray-200 text-gray-900" : "text-gray-700"
        }`}
        onClick={() => !isEditing && onThreadSelect(thread.id)}
        onContextMenu={(e: React.MouseEvent) => handleRightClick(e, thread.id)}
        onMouseEnter={() => {
          if (!hasAnimated && !hoverAnimationsDisabled) {
            setHasAnimated(true);
          }
        }}
        onMouseLeave={() => {
          if (!hoverAnimationsDisabled) {
            setHasAnimated(false);
          }
        }}
        onMouseMove={() => {
          // Re-enable hover animations on actual mouse movement
          if (hoverAnimationsDisabled) {
            setHoverAnimationsDisabled(false);
          }
        }}
      >
        <div className={`flex-shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4"} flex items-center justify-center -mr-1`}>
          {getProviderIcon(provider, modelName)}
        </div>
        
        {!collapsed && (
          <>
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRenameSubmit(thread.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameSubmit(thread.id);
                  } else if (e.key === "Escape") {
                    handleRenameCancel();
                  }
                }}
                className="flex-1 bg-transparent border-0 border-b border-gray-400 rounded-none focus:border-blue-500 focus:ring-0 focus:outline-none text-sm p-0 h-auto"
                autoFocus
              />
            ) : (
              <div className="flex-1 text-left relative overflow-hidden pr-0 group-hover:pr-16">
                <div className="flex items-center gap-1">
                  {isPinned && <PinIcon className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                  {thread.branchedFromThreadId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onThreadSelect(thread.branchedFromThreadId);
                      }}
                      className="flex-shrink-0"
                      title="Go to original conversation"
                    >
                      <GitBranchIcon className="h-3.5 w-3.5 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer" />
                    </button>
                  )}
                  <span 
                    className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-0.5"
                    title={thread.title || `Chat ${thread.id.slice(0, 8)}`}
                  >
                    {thread.title || `Chat ${thread.id.slice(0, 8)}`}
                  </span>
                </div>
              </div>
            )}
            
            {/* Hover Actions - Absolutely positioned to not take up layout space */}
            {!isEditing && (
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all duration-75 ${
                hasAnimated ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
              }`}>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePinThread(thread.id);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  size="sm"
                  variant="ghost"
                  disabled={updateThread.isLoading}
                  className={`h-7 w-7 p-0 rounded bg-gray-200/80 backdrop-blur-sm border border-gray-300/60 hover:bg-gray-300 hover:border-gray-400 ${isPinned ? 'text-blue-500' : ''} ${updateThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isPinned ? "Unpin" : "Pin"}
                >
                  <PinIcon className="h-3 w-3" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteThread(thread.id);
                  }}
                  size="sm"
                  variant="ghost"
                  disabled={deleteThread.isLoading}
                  className={`h-7 w-7 p-0 rounded bg-gray-200/80 backdrop-blur-sm border border-gray-300/60 hover:bg-red-200 hover:text-red-600 hover:border-red-300 ${deleteThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Delete"
                >
                  <TrashIcon className="h-3 w-3" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating buttons when collapsed */}
      {collapsed && (
        <div className={`fixed top-4 left-4 z-50 flex gap-2 transition-all duration-300 ease-in-out ${
          showFloatingButtons ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
        }`}>
          <Button
            onClick={handleNewChatCollapsed}
            size="sm"
            variant="ghost"
            title="New Chat"
            className="h-8 w-8 p-0 bg-white border border-gray-200 shadow-md hover:bg-gray-50 rounded-lg transition-all duration-300 ease-in-out"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={onToggleCollapse}
            size="sm"
            variant="ghost"
            title="Expand Sidebar"
            className="h-8 w-8 p-0 bg-white border border-gray-200 shadow-md hover:bg-gray-50 rounded-lg transition-all duration-300 ease-in-out"
          >
            <MenuIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 z-40 flex h-full flex-col transition-transform duration-500 ease-out ${
          collapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="h-full bg-gray-100 border-r border-gray-200 flex flex-col relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <Logo size="md" className="flex-shrink-0" />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onNavigateToSettings}
                size="sm"
                variant="ghost"
                title="Settings"
                className="h-8 w-8 p-0 hover:bg-gray-200"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleNewChat}
                size="sm"
                variant="ghost"
                title="New Chat"
                className="h-8 w-8 p-0 hover:bg-gray-200"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={onToggleCollapse}
                size="sm"
                variant="ghost"
                title="Collapse Sidebar"
                className="h-8 w-8 p-0 hover:bg-gray-200"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-transparent border border-gray-300 rounded-md focus:border-blue-500 focus:ring-0 focus:outline-none shadow-none text-sm transition-colors"
                style={{ outline: 'none', boxShadow: 'none' }}
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto hidden-scrollbar">
            <div className="px-3 py-2">
              {/* Pinned Threads Section */}
              {sortedPinnedThreads.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-1 py-2 mb-2">
                    <PinIcon className="h-3 w-3 text-gray-500" />
                    <span className="text-sm font-medium text-gray-500 tracking-wide">
                      Pinned
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sortedPinnedThreads.map((thread) => (
                      <ThreadItem key={thread.id} thread={thread} isPinned={true} />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Threads Section */}
              {sortedUnpinnedThreads.length > 0 && sortedPinnedThreads.length > 0 && (
                <div className="flex items-center gap-2 px-1 py-2 mb-2">
                  <MessageSquareIcon className="h-3 w-3 text-gray-500" />
                  <span className="text-sm font-medium text-gray-500 tracking-wide">
                    Recent
                  </span>
                </div>
              )}

              {/* Unpinned Threads */}
              <div className="space-y-1">
                {sortedUnpinnedThreads.map((thread) => (
                  <ThreadItem key={thread.id} thread={thread} isPinned={false} />
                ))}
              </div>
            </div>
          </div>

          {/* Footer with Account Button */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <Button
                onClick={onNavigateToAccount}
                variant="ghost"
                className="w-full justify-start text-left h-10 px-3 hover:bg-gray-200 transition-colors"
              >
                <UserIcon className="h-4 w-4 mr-3" />
                <span className="text-sm font-medium">
                  {user?.username || user?.firstName || "Account"}
                </span>
              </Button>
            </div>
          </div>

          {/* Resize Handle */}
          {!collapsed && (
            <div
              className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors group"
              onMouseDown={() => setIsResizing(true)}
            >
              <div className="w-full h-full bg-transparent group-hover:bg-blue-400" />
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const thread = threads?.find(t => t.id === contextMenu.threadId);
              handleRenameStart(contextMenu.threadId, thread?.title || "");
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <EditIcon className="h-3 w-3" />
            Rename
          </button>
          <button
            onClick={() => handlePinThread(contextMenu.threadId)}
            disabled={updateThread.isLoading}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${updateThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <PinIcon className="h-3 w-3" />
            {(threads?.find(t => t.id === contextMenu.threadId) as any)?.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => handleDeleteThread(contextMenu.threadId)}
            disabled={deleteThread.isLoading}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:text-red-600 flex items-center gap-2 ${deleteThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <TrashIcon className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </>
  );
} 
