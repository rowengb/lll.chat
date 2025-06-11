import { type NextPage } from "next";
import { useUser, SignInButton } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { ModelSelector } from "@/components/ModelSelector";
import PageTransition from "@/components/PageTransition";
import { trpc } from "@/utils/trpc";

const ChatPage: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { threadId } = router.query;
  const [selectedModel, setSelectedModel] = useState<string | null>(null); // Start with null to indicate loading
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 18rem = 288px

  // Get user's best default model
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery(
    undefined,
    { enabled: !!user } // Only run when user is logged in
  );

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

  // Get thread data to determine the last used model
  const { data: threads } = trpc.chat.getThreads.useQuery();
  const currentThread = threads?.find(thread => thread.id === threadId);

  useEffect(() => {
    // If no threadId in URL, redirect to home to create a new chat
    // But only if we're actually on this chat page route
    if (router.isReady && !threadId && router.pathname === "/chat/[threadId]") {
      router.push("/");
    }
  }, [router.isReady, threadId, router.pathname, router]);

  // Update selected model when switching threads (only if thread has a specific model)
  useEffect(() => {
    if (currentThread && selectedModel) {
      const threadModel = (currentThread as any).model || currentThread.lastModel;
      if (threadModel && threadModel !== selectedModel) {
        setSelectedModel(threadModel);
      }
      // Don't override with default if thread doesn't have a model - keep user's preference
    }
  }, [currentThread]); // Remove selectedModel from dependencies to prevent reverting user changes

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold">Welcome to lll.chat</h1>
          <SignInButton mode="modal">
            <button className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const handleThreadSelect = (newThreadId: string) => {
    router.push(`/chat/${newThreadId}`);
  };

  const handleThreadCreate = (newThreadId: string) => {
    router.push(`/chat/${newThreadId}`);
  };

  const handleToggleCollapse = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    // Immediately update width to prevent lag - chat window moves in sync with sidebar
    setSidebarWidth(newCollapsed ? 0 : 288);
  };

  // Don't render until we have a valid selectedModel
  if (!selectedModel) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <PageTransition>
      <Head>
        <title>lll.chat - {threadId}</title>
        <meta name="description" content="lll.chat - High-performance AI chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="h-screen">
        <Sidebar 
          currentThreadId={typeof threadId === "string" ? threadId : null}
          onThreadSelect={handleThreadSelect}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onWidthChange={setSidebarWidth}
        />
        <ChatWindow 
          threadId={typeof threadId === "string" ? threadId : null}
          onThreadCreate={handleThreadCreate}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          sidebarCollapsed={sidebarCollapsed}
          sidebarWidth={sidebarWidth}
        />
      </main>
    </PageTransition>
  );
};

export default ChatPage; 