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
import { SearchCommand } from '@/components/SearchCommand';
import { useSearchCommand } from '@/hooks/useSearchCommand';

const App: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [newChatModelChoice, setNewChatModelChoice] = useState<string | null>(null);
  
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

  // Navigation functions
  const navigateToWelcome = () => {
    router.push('/app', undefined, { shallow: true });
  };

  const navigateToChat = (threadId: string) => {
    router.push(`/chat/${threadId}`, undefined, { shallow: true });
  };

  const navigateToSettings = () => {
    router.push('/settings?tab=api-keys', undefined, { shallow: true });
  };

  const navigateToAccount = () => {
    router.push('/settings?tab=account', undefined, { shallow: true });
  };

  const handleThreadSelect = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleThreadCreate = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleNewChat = () => {
    setNewChatModelChoice(null);
    if (bestDefaultModel?.modelId) {
      setSelectedModel(bestDefaultModel.modelId);
    }
    navigateToWelcome();
  };

  // Custom model change handler for welcome screen
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    setNewChatModelChoice(modelId);
  };

  // Redirect to home if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.replace('/home');
    }
  }, [isLoaded, user, router]);

  // Don't render anything if redirecting
  if (isLoaded && !user) {
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

  return (
    <>
      <Head>
        <title>lll.chat — New Chat</title>
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
          currentThreadId={null}
          onOpenSearch={openSearch}
        />

        {/* Main Content - Welcome Screen */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedModel ? (
            <ChatWindow 
              threadId={null}
              onThreadCreate={handleThreadCreate}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={sidebarWidth}
              onToggleSidebar={toggleSidebar}
              onOpenSearch={openSearch}
              currentView="welcome"
              onNavigateToSettings={navigateToSettings}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <LoadingDots text="Loading" size="lg" />
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

export default App; 