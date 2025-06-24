import { type NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { LoadingDots } from "@/components/LoadingDots";
import { useChatStore } from "@/stores/chatStore";
import { trpc } from "@/utils/trpc";
import { SearchCommand } from '@/components/SearchCommand';
import { useSearchCommand } from '@/hooks/useSearchCommand';
import { useAppData } from '@/hooks/useAppData';
import { PerformanceProfiler } from '@/components/PerformanceProfiler';
import { useUser } from '@clerk/nextjs';
import { useHyperspeed, useInstantRender } from '@/hooks/useHyperspeed';

const ChatPage: NextPage = () => {
  const router = useRouter();
  const { threadId } = router.query;
  
  // Eager loaded app data - instant access!
  const { 
    user, 
    isLoaded, 
    isAuthenticated, 
    threads, 
    selectedModel: defaultModel, 
    isInitialLoad 
  } = useAppData();
  
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  
  const { 
    sidebarCollapsed, 
    sidebarWidth, 
    setSidebarWidth, 
    toggleSidebar 
  } = useChatStore();

  // Search command hook
  const { isOpen: isSearchOpen, openSearch, closeSearch } = useSearchCommand();

  // 🚀 HYPERSPEED OPTIMIZATIONS - Enable ALL performance features
  const { predictivelyPrefetch } = useHyperspeed();
  useInstantRender();

  const normalizedThreadId = typeof threadId === 'string' ? threadId : null;
  const currentThread = threads?.find(thread => thread.id === normalizedThreadId);
  const utils = trpc.useUtils();

  const updateThreadMetadataMutation = trpc.chat.updateThreadMetadata.useMutation();

  // Initialize selectedModel based on user preferences
  useEffect(() => {
    if (defaultModel && selectedModel === null) {
      setSelectedModel(defaultModel);
    }
  }, [defaultModel, selectedModel]);

  // Update model when switching threads, but preserve explicit user selections
  useEffect(() => {
    if (currentThread) {
      const threadModel = (currentThread as any).model || currentThread.lastModel;
      if (threadModel) {
        // Always update to the thread's last used model when switching threads
        setSelectedModel(threadModel);
      }
    }
  }, [currentThread?.id]); // Only run when thread ID changes

  // Navigation functions - all instant with shallow routing
  const navigateToWelcome = () => {
    router.push('/chat/new', undefined, { shallow: true });
  };

  const navigateToChat = (newThreadId: string) => {
    router.push(`/chat/${newThreadId}`, undefined, { shallow: true });
  };

  const navigateToSettings = () => {
    router.push('/settings', undefined, { shallow: true });
  };

  const navigateToAccount = () => {
    router.push('/settings?tab=account', undefined, { shallow: true });
  };

  const handleThreadSelect = (newThreadId: string) => {
    navigateToChat(newThreadId);
  };

  const handleThreadCreate = (newThreadId: string) => {
    navigateToChat(newThreadId);
  };

  const handleNewChat = () => {
    navigateToWelcome();
  };

  // Custom model change handler that is completely optimistic
  const handleModelChange = (modelId: string) => {
    // Only update UI immediately - no database calls
    setSelectedModel(modelId);
    // The model will be persisted when the user sends their next message
  };

  const getPageTitle = () => {
    if (currentThread?.title) {
      return `lll.chat — ${currentThread.title}`;
    }
    return 'lll.chat — Chat';
  };

  // Redirect to sign-in if not authenticated
  if (isLoaded && !isAuthenticated) {
    router.push('/sign-in');
    return null;
  }

  // Show loading while checking auth or loading critical data
  if (!isLoaded || isInitialLoad) {
    return (
      <div className="min-h-screen-mobile flex items-center justify-center">
        <LoadingDots text="Loading" size="lg" />
      </div>
    );
  }

  // Handle welcome screen case (no threadId means new chat)
  const isWelcomeScreen = !normalizedThreadId || normalizedThreadId === 'new';

  return (
    <>
      <Head>
        <title>{getPageTitle()}</title>
        <meta name="description" content="AI Chat Interface" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen-mobile bg-background" data-instant="true">
        {/* Sidebar - Instant render */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onWidthChange={setSidebarWidth}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onNavigateToSettings={navigateToSettings}
          onNavigateToAccount={navigateToAccount}
          onNavigateToWelcome={navigateToWelcome}
          currentThreadId={normalizedThreadId}
          onOpenSearch={openSearch}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedModel ? (
            <ChatWindow 
              threadId={isWelcomeScreen ? null : normalizedThreadId}
              onThreadCreate={handleThreadCreate}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={sidebarWidth}
              onToggleSidebar={toggleSidebar}
              onOpenSearch={openSearch}
              currentView={isWelcomeScreen ? "welcome" : "chat"}
              onNavigateToSettings={navigateToSettings}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <LoadingDots text="Loading chat" size="lg" />
            </div>
          )}
        </div>

        {/* Search Command */}
        <SearchCommand 
          isOpen={isSearchOpen} 
          onClose={closeSearch}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onNavigateToSettings={navigateToSettings}
          onNavigateToAccount={navigateToAccount}
        />

        {/* Performance Profiler - Only in development */}
        <PerformanceProfiler />
      </div>
    </>
  );
};

export default ChatPage; 