import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { LoadingDots } from "@/components/LoadingDots";
import { useChatStore } from "@/stores/chatStore";
import { useSearchCommand } from '@/hooks/useSearchCommand';
import { SearchCommand } from '@/components/SearchCommand';
import { trpc } from "@/utils/trpc";
import { useOpenRouterStore } from '@/stores/openRouterStore';

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

  const { useOpenRouter } = useOpenRouterStore();
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

  // Initialize selectedModel based on user preferences
  useEffect(() => {
    if (bestDefaultModel && selectedModel === null) {
      if (bestDefaultModel.modelId) {
        setSelectedModel(bestDefaultModel.modelId);
      } else {
        // Fallback when no API keys are available
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

  // Navigation handlers
  const navigateToWelcome = () => {
    router.push('/');
  };

  const navigateToChat = (threadId: string) => {
    router.push(`/c/${threadId}`);
  };

  const navigateToSettings = () => {
    router.push('/settings');
  };

  const navigateToAccount = () => {
    router.push('/settings?tab=account');
  };

  const handleThreadSelect = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleThreadCreate = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleNewChat = () => {
    navigateToWelcome();
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    
    // Update thread metadata if we're in an existing thread
    if (typeof threadId === 'string' && currentThread) {
      try {
        const updateThreadMetadataMutation = trpc.chat.updateThreadMetadata.useMutation();
        await updateThreadMetadataMutation.mutateAsync({
          threadId,
          lastModel: modelId,
        });
        
        // Invalidate and refetch threads to update the UI
        utils.chat.getThreads.invalidate();
      } catch (error) {
        console.error('Failed to update thread model:', error);
      }
    }
  };

  // Redirect to home if not authenticated
  if (!isLoaded) {
    return (
      <>
        <Head>
          <title>lll.chat - Loading</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
        </Head>
        <main className="h-screen flex items-center justify-center">
          <LoadingDots text="Loading" size="lg" />
        </main>
      </>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  if (!threadId || typeof threadId !== 'string') {
    router.push('/');
    return null;
  }

  if (!selectedModel) {
    return (
      <>
        <Head>
          <title>lll.chat - Loading Chat</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
        </Head>
        <main className="h-screen flex">
          <Sidebar 
            currentThreadId={threadId}
            onThreadSelect={handleThreadSelect}
            onNewChat={handleNewChat}
            onNavigateToSettings={navigateToSettings}
            onNavigateToAccount={navigateToAccount}
            onNavigateToWelcome={navigateToWelcome}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onWidthChange={setSidebarWidth}
            onOpenSearch={openSearch}
          />
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots text="Loading chat" size="lg" />
          </div>
        </main>
      </>
    );
  }

  const getPageTitle = () => {
    if (currentThread?.title) {
      return `${currentThread.title} - lll.chat`;
    }
    return "Chat - lll.chat";
  };

  return (
    <>
      <Head>
        <title>{getPageTitle()}</title>
        <meta name="description" content="lll.chat - High-performance AI chat application" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <main className="h-screen flex">
        <Sidebar 
          currentThreadId={threadId}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onNavigateToSettings={navigateToSettings}
          onNavigateToAccount={navigateToAccount}
          onNavigateToWelcome={navigateToWelcome}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onWidthChange={setSidebarWidth}
          onOpenSearch={openSearch}
        />
        
        <div className="flex-1">
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
        </div>

        <SearchCommand
          isOpen={isSearchOpen}
          onClose={closeSearch}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChat}
          onNavigateToSettings={navigateToSettings}
          onNavigateToAccount={navigateToAccount}
          onModelChange={handleModelChange}
          currentThreadId={threadId}
        />
      </main>
    </>
  );
};

export default ChatPage; 