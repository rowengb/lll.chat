import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { LoadingDots } from "@/components/LoadingDots";
import { useChatStore } from "@/stores/chatStore";
import { trpc } from "@/utils/trpc";
import { useOpenRouterStore } from '@/stores/openRouterStore';
import { SearchCommand } from '@/components/SearchCommand';
import { useSearchCommand } from '@/hooks/useSearchCommand';

const ChatPage: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { threadId } = router.query;
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  
  const { 
    sidebarCollapsed, 
    sidebarWidth, 
    setSidebarWidth, 
    toggleSidebar 
  } = useChatStore();

  // Search command hook
  const { isOpen: isSearchOpen, openSearch, closeSearch } = useSearchCommand();

  // Get user's best default model
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Get thread data to determine the last used model
  const { data: threads } = trpc.chat.getThreads.useQuery();
  const currentThread = threads?.find(thread => thread.id === threadId);
  const utils = trpc.useUtils();

  const updateThreadMetadataMutation = trpc.chat.updateThreadMetadata.useMutation();

  // Initialize selectedModel based on user preferences
  useEffect(() => {
    if (bestDefaultModel && selectedModel === null) {
      if (bestDefaultModel.modelId) {
        setSelectedModel(bestDefaultModel.modelId);
      } else {
        setSelectedModel('gpt-4o');
      }
    }
  }, [bestDefaultModel, selectedModel]);

  // Update selected model when switching threads to remember the last model used in that chat
  useEffect(() => {
    if (currentThread) {
      const threadModel = (currentThread as any).model || currentThread.lastModel;
      if (threadModel && threadModel !== selectedModel) {
        setSelectedModel(threadModel);
      }
    }
  }, [currentThread, selectedModel]);

  // Navigation functions
  const navigateToWelcome = () => {
    router.push('/', undefined, { shallow: true });
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

  // Custom model change handler that persists the selection to the current thread
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    
    if (threadId && typeof threadId === 'string') {
      try {
        await updateThreadMetadataMutation.mutateAsync({
          threadId: threadId,
          lastModel: modelId,
        });
        
        utils.chat.getThreads.invalidate();
      } catch (error) {
        console.error('Failed to update thread model:', error);
      }
    }
  };

  const getPageTitle = () => {
    if (currentThread?.title) {
      return `lll.chat — ${currentThread.title}`;
    }
    return 'lll.chat — Chat';
  };

  // Redirect to sign-in if not authenticated
  if (isLoaded && !user) {
    router.push('/sign-in');
    return null;
  }

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen-mobile flex items-center justify-center">
        <LoadingDots text="Loading" size="lg" />
      </div>
    );
  }

  // Show loading if no threadId yet
  if (!threadId || typeof threadId !== 'string') {
    return (
      <div className="min-h-screen-mobile flex items-center justify-center">
        <LoadingDots text="Loading chat" size="lg" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{getPageTitle()}</title>
        <meta name="description" content="AI Chat Interface" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen-mobile bg-background">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onWidthChange={setSidebarWidth}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onNavigateToSettings={navigateToSettings}
          onNavigateToAccount={navigateToAccount}
          onNavigateToWelcome={navigateToWelcome}
          currentThreadId={threadId}
          onOpenSearch={openSearch}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedModel ? (
            <ChatWindow 
              threadId={threadId}
              onThreadCreate={handleThreadCreate}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={sidebarWidth}
              onToggleSidebar={toggleSidebar}
              onOpenSearch={openSearch}
              currentView="chat"
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
      </div>
    </>
  );
};

export default ChatPage; 