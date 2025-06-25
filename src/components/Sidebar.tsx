import { useState, useRef, useEffect } from "react";
import { PlusIcon, MessageSquareIcon, SettingsIcon, ChevronLeftIcon, SearchIcon, TrashIcon, PinIcon, MoreVerticalIcon, EditIcon, Waves, UserIcon, LogOutIcon, GitBranchIcon, XIcon, PinOffIcon, PanelLeftIcon, SunIcon, MoonIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";
import { getProviderIcon } from "./ModelSelector";
import toast from "react-hot-toast";
import Logo from './Logo';
import { useChatStore } from "../stores/chatStore";
import { useTheme } from '@/hooks/useTheme';
import { CustomScrollbar } from './CustomScrollbar';


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

// Time categorization utility functions
const getTimeCategory = (creationTime: number): string => {
  const now = new Date();
  const threadDate = new Date(creationTime);
  
  // Reset time to start of day for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const threadDateStart = new Date(threadDate.getFullYear(), threadDate.getMonth(), threadDate.getDate());
  
  if (threadDateStart.getTime() >= today.getTime()) {
    return 'Today';
  } else if (threadDateStart.getTime() >= yesterday.getTime()) {
    return 'Yesterday';
  } else if (threadDateStart.getTime() >= weekAgo.getTime()) {
    return 'Last 7 Days';
  } else if (threadDateStart.getTime() >= monthAgo.getTime()) {
    return 'Last 30 Days';
  } else {
    return 'Older';
  }
};

const getCategoryOrder = (category: string): number => {
  const order = {
    'Today': 0,
    'Yesterday': 1,
    'Last 7 Days': 2,
    'Last 30 Days': 3,
    'Older': 4
  };
  return order[category as keyof typeof order] || 5;
};

const groupThreadsByTime = (threads: any[]) => {
  const grouped = threads.reduce((acc, thread) => {
    const category = getTimeCategory(thread._creationTime);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(thread);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Sort threads within each category by creation time (newest first)
  Object.keys(grouped).forEach(category => {
    grouped[category].sort((a: any, b: any) => b._creationTime - a._creationTime);
  });
  
  return grouped;
};

interface SidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewChat?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAccount?: () => void;
  onNavigateToWelcome?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onWidthChange?: (width: number) => void;
  onOpenSearch?: () => void;
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewChat?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToAccount?: () => void;
  onNavigateToWelcome?: () => void;
  onOpenSearch?: () => void;
}

interface ContextMenu {
  threadId: string;
  x: number;
  y: number;
}

// Mobile Sidebar Component
function MobileSidebar({ isOpen, onClose, currentThreadId, onThreadSelect, onNewChat, onNavigateToSettings, onNavigateToAccount, onNavigateToWelcome, onOpenSearch }: MobileSidebarProps) {
  const { user } = useUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  // Body scroll lock for mobile sidebar
  useEffect(() => {
    const body = document.body;
    
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      body.style.setProperty('--scroll-y', `-${scrollY}px`);
      
      // Apply scroll lock
      body.classList.add('body-scroll-lock-mobile');
    } else {
      // Remove scroll lock
      body.classList.remove('body-scroll-lock-mobile');
      
      // Restore scroll position
      const scrollY = body.style.getPropertyValue('--scroll-y');
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
        body.style.removeProperty('--scroll-y');
      }
    }

    // Cleanup on unmount
    return () => {
      body.classList.remove('body-scroll-lock-mobile');
      body.style.removeProperty('--scroll-y');
    };
  }, [isOpen]);

  const utils = trpc.useUtils();
  const { data: threads } = trpc.chat.getThreads.useQuery(undefined, {
    // Use same settings as main sidebar for consistency
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1000, // 1 second
    cacheTime: 5000, // 5 seconds  
    refetchInterval: false,
  });
  const { data: models } = trpc.models.getModels.useQuery();

  const updateThread = trpc.chat.updateThread.useMutation({
    onMutate: async (newData) => {
      await utils.chat.getThreads.cancel();
      const previousThreads = utils.chat.getThreads.getData();
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
      return { previousThreads };
    },
    onError: (err, newData, context) => {
      if (context?.previousThreads) {
        utils.chat.getThreads.setData(undefined, context.previousThreads);
      }
      toast.dismiss();
      toast.error("Failed to update conversation");
    },
  });

  // Filter threads based on search query
  const filteredThreads = threads?.filter(thread => 
    thread.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.model?.toLowerCase().includes(searchQuery.toLowerCase())
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

  // Group unpinned threads by time
  const groupedUnpinnedThreads = groupThreadsByTime(unpinnedThreads);
  
  // Define the correct order and filter only existing categories
  const categoryOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];
  const timeCategories = categoryOrder.filter(category => 
    groupedUnpinnedThreads[category] && groupedUnpinnedThreads[category].length > 0
  );

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
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

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const ThreadItem = ({ thread, isPinned }: { thread: any; isPinned: boolean }) => {
    const provider = getProviderFromModel(thread.model, models);
    const modelName = getModelNameFromId(thread.model, models);
    const isEditing = editingThread === thread.id;
    
    return (
      <div
                  className={`group relative flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-white dark:hover:bg-muted cursor-pointer ${
            currentThreadId === thread.id ? "bg-white dark:bg-muted text-foreground" : "text-muted-foreground"
        }`}
        onClick={() => !isEditing && onThreadSelect(thread.id)}
        onContextMenu={(e: React.MouseEvent) => handleRightClick(e, thread.id)}
      >
        <div className="flex-shrink-0 h-4 w-4 flex items-center justify-center">
          {getProviderIcon(provider, modelName)}
        </div>
        <div className="flex-1 min-w-0">
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
              className="bg-transparent border-0 border-b border-border rounded-none focus:border-primary focus:ring-0 focus:outline-none text-sm p-0 h-auto"
              autoFocus
            />
          ) : (
            <>
              <div 
                className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRenameStart(thread.id, thread.title || "");
                }}
                title="Double-click to rename"
              >
                {thread.title || `${thread.model} conversation`}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date((thread as any)._creationTime).toLocaleDateString()}
              </div>
            </>
          )}
        </div>
        {isPinned && !isEditing && (
          <PinIcon className="h-3 w-3 text-primary flex-shrink-0" />
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      <div className={`sm:hidden fixed inset-0 z-50 ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}>
        {/* Backdrop - Blur only */}
        <div 
          className={`fixed inset-0 backdrop-blur-md transition-opacity duration-200 ease-out ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
        />
        
        {/* Sidebar Panel with rounded corners and margins */}
        <div 
          className={`fixed transition-opacity duration-300 ease-out ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: '16px',
            left: '16px',
            right: '16px',
            maxHeight: 'calc(100vh - 32px)',
            minHeight: 'auto'
          }}
        >
          <div 
            className="relative max-h-full"
          >
            {/* Background with rounded corners and shadow */}
            <div 
              className="absolute inset-0 bg-gray-100 dark:bg-gray-950 border border-gray-400/30 dark:border-gray-500/30 shadow-lg"
              style={{ borderRadius: '16px' }}
            />
            
            {/* Content */}
            <div className="relative z-10 flex flex-col overflow-hidden" style={{ borderRadius: '16px' }}>
              {/* Floating buttons inside mobile sidebar */}
              <div 
                className="absolute z-50 transition-opacity duration-200 ease-out opacity-100"
                style={{
                  top: '16px',
                  left: '16px'
                }}
              >
                <div 
                  className="bg-white dark:bg-muted border border-border shadow-sm" 
                  style={{ 
                    borderRadius: '12px',
                    padding: '4px'
                  }}
                >
                  <div className="flex gap-1">
                    <Button
                      onClick={onClose}
                      size="sm"
                      variant="ghost"
                      title="Collapse Sidebar"
                      className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
                    >
                      <PanelLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={onNewChat}
                      size="sm"
                      variant="ghost"
                      title="New Chat"
                      className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
                    >
                      <PlusIcon className="h-4.25 w-4.25" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Header */}
              <div className="flex items-center p-4 border-b border-border gap-3">
                <div className="w-20 flex-shrink-0"></div> {/* Spacer for floating buttons */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="bg-white dark:bg-muted border border-border shadow-sm px-3 py-1.5 hover:bg-white dark:hover:bg-muted/80 transition-colors cursor-pointer w-full max-w-none flex items-center justify-center" style={{ borderRadius: '12px' }} onClick={onNavigateToWelcome}>
                    <Logo size="sm" className="flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* New Chat Button */}
              <div className="px-4 py-3 pb-2">
                <Button
                  onClick={onNewChat}
                  className="w-full text-white dark:text-black h-10 text-sm font-medium transition-all duration-200 shadow-sm"
                  style={{ 
                    borderRadius: '12px',
                    backgroundColor: '#3D80F6',
                    border: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3D80F6';
                  }}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </div>

              {/* Search Bar */}
              <div className="px-3 pt-2 pb-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-transparent border-0 rounded-none focus:border-primary focus:ring-0 focus:outline-none shadow-none text-sm transition-colors text-foreground placeholder:text-muted-foreground"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                  <div className="absolute bottom-0 left-2 right-2 h-px bg-border"></div>
                </div>
              </div>

              {/* Thread List */}
                              <div className="overflow-y-auto mobile-hidden-scrollbar max-h-[50vh] min-h-0">
                <div className="px-3 py-2">
                  {/* Pinned Threads Section */}
                  {sortedPinnedThreads.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 px-1 py-2 mb-2">
                        <PinIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground tracking-wide">
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

                  {/* Time-based Thread Categories */}
                  {timeCategories.map((category, categoryIndex) => (
                    <div key={category} className={categoryIndex > 0 || sortedPinnedThreads.length > 0 ? "mt-4" : ""}>
                      <div className="flex items-center gap-2 px-1 py-2 mb-2">
                        <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground tracking-wide">
                          {category}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {groupedUnpinnedThreads[category].map((thread: any) => (
                          <ThreadItem key={thread.id} thread={thread} isPinned={false} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer with Account Button */}
              <div className="border-t border-border p-3">
                <div className="flex items-center justify-between">
                  <Button
                    onClick={onNavigateToAccount}
                    variant="ghost"
                    className="flex-1 justify-start text-left h-10 px-3 hover:bg-white dark:hover:bg-muted transition-colors"
                  >
                    <UserIcon className="h-4 w-4 mr-3" />
                    <span className="text-sm font-medium">
                      {user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user?.username || user?.firstName || "Account"}
                    </span>
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={handleThemeToggle}
                      size="sm"
                      variant="ghost"
                      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                      className="h-10 w-10 p-0 hover:bg-white dark:hover:bg-muted"
                    >
                      {resolvedTheme === 'dark' ? (
                        <SunIcon className="h-5 w-5" />
                      ) : (
                        <MoonIcon className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      onClick={onNavigateToSettings}
                      size="sm"
                      variant="ghost"
                      title="Settings"
                      className="h-10 w-10 p-0 hover:bg-white dark:hover:bg-muted"
                    >
                      <SettingsIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const thread = threads?.find(t => t.id === contextMenu.threadId);
              handleRenameStart(contextMenu.threadId, thread?.title || "");
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-muted flex items-center gap-2"
          >
            <EditIcon className="h-3 w-3" />
            Rename
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar({ currentThreadId, onThreadSelect, onNewChat, onNavigateToSettings, onNavigateToAccount, onNavigateToWelcome, collapsed, onToggleCollapse, onWidthChange, onOpenSearch }: SidebarProps) {
  const router = useRouter();
  const { user } = useUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showFloatingButtons, setShowFloatingButtons] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 18rem = 288px
  const [isResizing, setIsResizing] = useState(false);
  
  const [hoverAnimationsDisabled, setHoverAnimationsDisabled] = useState(false);
  
  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    threadId: string | null;
    threadTitle: string | null;
  }>({
    isOpen: false,
    threadId: null,
    threadTitle: null,
  });
  
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
    // Use same settings as main sidebar for consistency
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1000, // 1 second
    cacheTime: 5000, // 5 seconds  
    refetchInterval: false,
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
      // Force immediate invalidation and refetch
      utils.chat.getThreads.invalidate();
      // Navigate immediately while cache updates
      onThreadSelect(newThread.id);
    },
    onError: () => {
      toast.dismiss();
      toast.error("Failed to create new conversation");
    },
  });

    // NO optimistic updates - they fight with our immediate clearing
    onSuccess: () => {
      // Just ensure server sync - the UI already updated immediately
      console.log("🗑️ Server deletion completed");
    },
    onError: (err) => {
      // If server deletion fails, we need to restore the thread
      console.error("❌ Server deletion failed:", err);
      toast.dismiss();
      toast.error("Failed to delete conversation on server - refreshing...");
      // Force a refetch to restore server state
      utils.chat.getThreads.invalidate();
    },        utils.chat.getThreads.setData(undefined, context.previousThreads);
      }
      toast.dismiss();
      toast.error("Failed to delete conversation");
    },
  });

  const updateThread = trpc.chat.updateThread.useMutation({
    onMutate: async (newData) => {
      await utils.chat.getThreads.cancel();
      const previousThreads = utils.chat.getThreads.getData();
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
      return { previousThreads };
    },
    onError: (err, newData, context) => {
      if (context?.previousThreads) {
        utils.chat.getThreads.setData(undefined, context.previousThreads);
      }
      toast.dismiss();
      toast.error("Failed to update conversation");
    },
  });

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

  // Close delete confirmation modal when pressing Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && deleteConfirmation.isOpen) {
        handleCancelDelete();
      }
    };

    if (deleteConfirmation.isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [deleteConfirmation.isOpen]);

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
      // Add 16px for right margin between sidebar and content
      onWidthChange?.(sidebarWidth + 16);
    }
  }, [sidebarWidth, collapsed, onWidthChange]);

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Instant navigation to unified chat route
      router.replace("/chat/new", undefined, { shallow: true });
    }
  };

  const handleNewChatCollapsed = () => {
    if (onNewChat) {
      onNewChat();
    } else {
      // Instant navigation to unified chat route
      router.replace("/chat/new", undefined, { shallow: true });
    }
  };

  const handleDeleteThread = (threadId: string) => {
    // Prevent multiple calls while mutation is in progress
    if (deleteThread.isLoading) return;
    
    // Find the thread to get its title
    const thread = threads?.find(t => t.id === threadId);
    const threadTitle = thread?.title || `Chat ${threadId.slice(0, 8)}`;
    
    // Show confirmation modal
    setDeleteConfirmation({
      isOpen: true,
      threadId,
      threadTitle,
    });
    setContextMenu(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmation.threadId) return;
    
    const threadIdToDelete = deleteConfirmation.threadId;
    
    console.log("🚀 NUCLEAR DELETION STARTED for thread:", threadIdToDelete);
    
    // 1. IMMEDIATELY remove from global store - no waiting!
    const { deleteThread: deleteFromStore } = useChatStore.getState();
    deleteFromStore(threadIdToDelete);
    console.log("✅ Removed from chat store");
    
    // 2. NUCLEAR CACHE CLEARING - multiple strategies
    // Cancel any ongoing queries first
    utils.chat.getThreads.cancel();
    
    // Clear TRPC cache immediately
    utils.chat.getThreads.setData(undefined, (old) => {
      console.log("�� Before filter:", old?.length || 0, "threads");
      const filtered = old?.filter(thread => thread.id !== threadIdToDelete) || [];
      console.log("🔥 After filter:", filtered.length, "threads");
      return filtered;
    });
    
    // Force multiple invalidations with different timing to be absolutely sure
    utils.chat.getThreads.invalidate();
    setTimeout(() => utils.chat.getThreads.invalidate(), 10);
    setTimeout(() => utils.chat.getThreads.invalidate(), 100);
    setTimeout(() => utils.chat.getThreads.invalidate(), 500);
    
    console.log("✅ TRPC cache nuked");
    
    // 3. Navigate away if this was the current thread
    if (currentThreadId === threadIdToDelete) {
      router.push("/");
    }
    
    // 4. Close modal immediately
    setDeleteConfirmation({
      isOpen: false,
      threadId: null,
      threadTitle: null,
    });
    
    // 5. Show success toast
    toast.dismiss();
    toast.success("Conversation deleted");
    
    // 6. FINALLY trigger server deletion (fire and forget)
    deleteThread.mutate({ id: threadIdToDelete });
    console.log("🔥 Server deletion triggered");
  };  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({
      isOpen: false,
      threadId: null,
      threadTitle: null,
    });
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

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
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

  // Group unpinned threads by time
  const groupedUnpinnedThreads = groupThreadsByTime(unpinnedThreads);
  
  // Define the correct order and filter only existing categories
  const categoryOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];
  const timeCategories = categoryOrder.filter(category => 
    groupedUnpinnedThreads[category] && groupedUnpinnedThreads[category].length > 0
  );

  const ThreadItem = ({ thread, isPinned }: { thread: any; isPinned: boolean }) => {
    const provider = getProviderFromModel(thread.model, models);
    const modelName = getModelNameFromId(thread.model, models);
    const isEditing = editingThread === thread.id;
    const [hasAnimated, setHasAnimated] = useState(false);
    
    return (
      <div
        className={`group relative flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-white dark:hover:bg-muted cursor-pointer ${
                          currentThreadId === thread.id ? "bg-white dark:bg-muted text-foreground" : "text-muted-foreground"
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
                className="flex-1 bg-transparent border-0 border-b border-border rounded-none focus:border-primary focus:ring-0 focus:outline-none text-sm p-0 h-auto"
                autoFocus
              />
            ) : (
              <div className="flex-1 text-left relative overflow-hidden pr-0 group-hover:pr-16">
                <div className="flex items-center gap-1">
                  {thread.branchedFromThreadId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onThreadSelect(thread.branchedFromThreadId);
                      }}
                      className="flex-shrink-0"
                      title="Go to original conversation"
                    >
                      <GitBranchIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                    </button>
                  )}
                  <span 
                    className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 ml-0.5 cursor-pointer hover:text-primary transition-colors"
                    title={`${thread.title || `Chat ${thread.id.slice(0, 8)}`} - Double-click to rename`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleRenameStart(thread.id, thread.title || "");
                    }}
                  >
                    {thread.title || `Chat ${thread.id.slice(0, 8)}`}
                  </span>
                </div>
              </div>
            )}
            
            {/* Hover Actions - Absolutely positioned to not take up layout space */}
            {!isEditing && (
              <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all duration-75 ${
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
                  className={`h-7 w-7 p-0 rounded bg-card/80 backdrop-blur-sm hover:bg-white dark:hover:bg-muted border border-border/50 ${isPinned ? 'text-primary' : ''} ${updateThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isPinned ? "Unpin" : "Pin"}
                >
                  {isPinned ? <PinOffIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteThread(thread.id);
                  }}
                  size="sm"
                  variant="ghost"
                  disabled={deleteThread.isLoading}
                  className={`h-7 w-7 p-0 rounded bg-card/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive border border-border/50 ${deleteThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Delete"
                >
                  <XIcon className="h-4 w-4" />
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
      {/* Floating buttons - Collapsed state (with search) */}
      <div 
        className={`hidden sm:block fixed z-50 transition-opacity duration-200 ease-out ${
          collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: '32px', // Align with where sidebar would be positioned
          left: '32px' // Same as expanded state for proper alignment
        }}
      >
        <div 
          className="bg-white dark:bg-muted border border-border shadow-sm" 
          style={{ 
            borderRadius: '12px', // Rounded corner rectangle to match other elements
            padding: '4px'
          }}
        >
          <div className="flex gap-1">
            <Button
              onClick={onToggleCollapse}
              size="sm"
              variant="ghost"
              title="Expand Sidebar"
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
            >
              <PanelLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleNewChat}
              size="sm"
              variant="ghost"
              title="New Chat"
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
            >
              <PlusIcon className="h-4.25 w-4.25" />
            </Button>
            <Button
              onClick={onOpenSearch}
              size="sm"
              variant="ghost"
              title="Search (Ctrl+K)"
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Floating buttons - Expanded state (no search) */}
      <div 
        className={`hidden sm:block fixed z-50 transition-opacity duration-200 ease-out ${
          !collapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: '32px', // Align with sidebar top margin + internal padding
          left: '32px' // Align with sidebar left margin + internal padding
        }}
      >
        <div 
          className="bg-white dark:bg-muted border border-border shadow-sm" 
          style={{ 
            borderRadius: '12px',
            padding: '4px'
          }}
        >
          <div className="flex gap-1">
            <Button
              onClick={onToggleCollapse}
              size="sm"
              variant="ghost"
              title="Collapse Sidebar"
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
            >
              <PanelLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleNewChat}
              size="sm"
              variant="ghost"
              title="New Chat"
              className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-card rounded-full transition-colors"
            >
              <PlusIcon className="h-4.25 w-4.25" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Sidebar */}
      <div 
        className={`fixed z-40 flex flex-col transition-all duration-300 ease-out ${
          collapsed ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'
        } hidden sm:flex`}
        style={{ 
          width: `${sidebarWidth - 32}px`, // Reduce width to account for margins
          top: '16px', // Top margin
          bottom: '16px', // Bottom margin
          left: '16px' // Left margin
        }}
      >
        <div 
          className="h-full relative"
        >
          {/* Background with rounded corners and shadow */}
          <div 
            className="absolute inset-0 bg-gray-100 dark:bg-gray-950 border border-gray-400/30 dark:border-gray-500/30 shadow-lg"
            style={{
              borderRadius: '16px', // Rounded corners
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 h-full flex flex-col overflow-hidden" style={{ borderRadius: '16px' }}>
          {/* Header */}
          <div className="flex items-center p-4 border-b border-border gap-3">
            <div className="w-20 flex-shrink-0"></div> {/* Spacer for floating buttons */}
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-white dark:bg-muted border border-border shadow-sm px-3 py-1.5 hover:bg-white dark:hover:bg-muted/80 transition-colors cursor-pointer w-full max-w-none flex items-center justify-center" style={{ borderRadius: '12px' }} onClick={onNavigateToWelcome}>
                <Logo size="sm" className="flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="px-4 py-3 pb-2">
            <Button
              onClick={handleNewChat}
              className="w-full text-white dark:text-black h-10 text-sm font-medium transition-all duration-200 shadow-sm"
              style={{ 
                borderRadius: '12px',
                backgroundColor: '#3D80F6',
                border: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3D80F6';
              }}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Search Bar */}
          <div className="px-3 pt-2 pb-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-transparent border-0 rounded-none focus:border-primary focus:ring-0 focus:outline-none shadow-none text-sm transition-colors text-foreground placeholder:text-muted-foreground"
                style={{ outline: 'none', boxShadow: 'none' }}
              />
              <div className="absolute bottom-0 left-2 right-2 h-px bg-border"></div>
            </div>
          </div>

          {/* Thread List */}
          {/* Mobile: Native scrollbar with mobile-hidden */}
          <div className="flex-1 overflow-y-auto mobile-hidden-scrollbar sm:hidden">
            <div className="px-3 py-2">
              {/* Pinned Threads Section */}
              {sortedPinnedThreads.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-1 py-2 mb-2">
                    <PinIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground tracking-wide">
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

              {/* Time-based Thread Categories */}
              {timeCategories.map((category, categoryIndex) => (
                <div key={category} className={categoryIndex > 0 || sortedPinnedThreads.length > 0 ? "mt-4" : ""}>
                  <div className="flex items-center gap-2 px-1 py-2 mb-2">
                    <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground tracking-wide">
                      {category}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {groupedUnpinnedThreads[category].map((thread: any) => (
                      <ThreadItem key={thread.id} thread={thread} isPinned={false} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: Custom scrollbar */}
          <div className="hidden sm:block flex-1 overflow-hidden">
            <CustomScrollbar className="h-full">
              <div className="px-3 py-2">
                {/* Pinned Threads Section */}
                {sortedPinnedThreads.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 px-1 py-2 mb-2">
                      <PinIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground tracking-wide">
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

                {/* Time-based Thread Categories */}
                {timeCategories.map((category, categoryIndex) => (
                  <div key={category} className={categoryIndex > 0 || sortedPinnedThreads.length > 0 ? "mt-4" : ""}>
                    <div className="flex items-center gap-2 px-1 py-2 mb-2">
                      <MessageSquareIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground tracking-wide">
                        {category}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {groupedUnpinnedThreads[category].map((thread: any) => (
                        <ThreadItem key={thread.id} thread={thread} isPinned={false} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CustomScrollbar>
          </div>

          {/* Footer with Account Button */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={onNavigateToAccount}
                variant="ghost"
                className="flex-1 min-w-0 justify-start text-left h-10 px-3 hover:bg-white dark:hover:bg-muted transition-colors"
              >
                <UserIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium ml-3 truncate">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user?.username || user?.firstName || "Account"}
                </span>
              </Button>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  onClick={handleThemeToggle}
                  size="sm"
                  variant="ghost"
                  title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                  className="h-10 w-10 p-0 hover:bg-white dark:hover:bg-muted flex-shrink-0"
                >
                  {resolvedTheme === 'dark' ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  onClick={onNavigateToSettings}
                  size="sm"
                  variant="ghost"
                  title="Settings"
                  className="h-10 w-10 p-0 hover:bg-white dark:hover:bg-muted flex-shrink-0"
                >
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          </div>
          
          {/* Resize Handle */}
          {!collapsed && (
            <div
              className="absolute top-4 bottom-4 -right-0.5 w-1 cursor-col-resize bg-transparent hover:bg-primary transition-colors rounded-full z-10"
              onMouseDown={() => setIsResizing(true)}
              onDoubleClick={() => {
                setSidebarWidth(288); // Reset to default width
                toast.dismiss();
                toast.success("Sidebar width reset to default");
              }}
              title="Drag to resize • Double-click to reset"
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCancelDelete}
        >
          <div 
            className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                <XIcon className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Delete Conversation</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-foreground mb-6">
              Are you sure you want to delete "{deleteConfirmation.threadTitle}"? This will permanently remove the conversation and all its messages.
            </p>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={deleteThread.isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteThread.isLoading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteThread.isLoading ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={!collapsed}
        onClose={() => onToggleCollapse()}
        currentThreadId={currentThreadId}
        onThreadSelect={(threadId: string) => {
          onThreadSelect(threadId);
          onToggleCollapse(); // Close sidebar after selection
        }}
        onNewChat={() => {
          onNewChat?.();
          onToggleCollapse(); // Close sidebar after new chat
        }}
        onNavigateToSettings={() => {
          onNavigateToSettings?.();
          onToggleCollapse(); // Close sidebar after navigation
        }}
        onNavigateToAccount={() => {
          onNavigateToAccount?.();
          onToggleCollapse(); // Close sidebar after navigation
        }}
        onNavigateToWelcome={() => {
          onNavigateToWelcome?.();
          onToggleCollapse(); // Close sidebar after navigation
        }}
        onOpenSearch={onOpenSearch}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const thread = threads?.find(t => t.id === contextMenu.threadId);
              handleRenameStart(contextMenu.threadId, thread?.title || "");
            }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-muted flex items-center gap-2"
          >
            <EditIcon className="h-3 w-3" />
            Rename
          </button>
          <button
            onClick={() => handlePinThread(contextMenu.threadId)}
            disabled={updateThread.isLoading}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-muted flex items-center gap-2 ${updateThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <PinIcon className="h-3 w-3" />
            {(threads?.find(t => t.id === contextMenu.threadId) as any)?.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => handleDeleteThread(contextMenu.threadId)}
            disabled={deleteThread.isLoading}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:text-red-600 flex items-center gap-2 ${deleteThread.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <XIcon className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </>
  );
} 
