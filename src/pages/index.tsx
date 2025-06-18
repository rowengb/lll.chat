import { type NextPage } from "next";
import { useUser, SignInButton } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { LoadingDots } from "@/components/LoadingDots";
import { useChatStore } from "@/stores/chatStore";
import { Button } from "@/components/ui/button";
import { Waves, MessageSquare, Zap, Shield, Key } from "lucide-react";
import { useSearchCommand } from '@/hooks/useSearchCommand';
import { SearchCommand } from '@/components/SearchCommand';
import Logo from '../components/Logo';
import { trpc } from "@/utils/trpc";

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  
  const { 
    sidebarCollapsed, 
    sidebarWidth, 
    setSidebarWidth, 
    toggleSidebar 
  } = useChatStore();

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
        // Fallback when no API keys are available
        setSelectedModel('gpt-4o');
      }
    }
  }, [bestDefaultModel, selectedModel]);

  // Navigation handlers
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
    // Stay on welcome page for new chat
    setSelectedModel(bestDefaultModel?.modelId || 'gpt-4o');
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
  };

  // Loading state
  if (!isLoaded) {
    return (
      <>
        <Head>
          <title>lll.chat - High-Performance AI Chat</title>
          <meta name="description" content="Experience lightning-fast AI conversations with lll.chat's optimized chat platform" />
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
        
        <main className="h-screen flex items-center justify-center">
          <LoadingDots text="Loading" size="lg" />
        </main>
      </>
    );
  }

  // Landing page for unauthenticated users
  if (!user) {
    return (
      <>
        <Head>
          <title>lll.chat - High-Performance AI Chat</title>
          <meta name="description" content="Experience lightning-fast AI conversations with lll.chat's optimized chat platform" />
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
        
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
          {/* Header */}
          <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center gap-2">
                  <Logo size="md" />
                </div>
                <div className="flex items-center gap-4">
                  <SignInButton mode="modal">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                      Sign In
                    </Button>
                  </SignInButton>
                  <SignInButton mode="modal">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      Get Started
                    </Button>
                  </SignInButton>
                </div>
              </div>
            </div>
          </header>

          {/* Hero Section */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-16">
              <div className="flex justify-center mb-6">
                <div className="flex items-center bg-card rounded-2xl p-4 shadow-sm border border-border">
                  <Logo size="xl" />
                </div>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-foreground mb-6">
                High-Performance
                <br />
                <span className="font-semibold">AI Chat</span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
                Experience lightning-fast AI conversations with multiple models, 
                optimized performance, and a clean, intuitive interface.
              </p>
              
              <div className="bg-card border border-border rounded-lg p-4 mb-8 max-w-2xl mx-auto">
                <p className="text-foreground text-sm font-medium flex items-center justify-center gap-2">
                  <Key className="h-4 w-4" />
                  BYOK (Bring Your Own Key) - Use your own API keys for full control and privacy
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SignInButton mode="modal">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3">
                    Start Chatting Free
                  </Button>
                </SignInButton>
                <Button size="lg" className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-8 py-3">
                  Learn More
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <Zap className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground">Optimized for speed with real-time streaming and efficient token management.</p>
              </div>
              
              <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <MessageSquare className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Multiple Models</h3>
                <p className="text-muted-foreground">Access GPT-4, Claude, Gemini, and other leading AI models in one place.</p>
              </div>
              
              <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-muted rounded-xl">
                    <Shield className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">BYOK & Privacy</h3>
                <p className="text-muted-foreground">Bring your own API keys for full control. Your data stays private with enterprise-grade security.</p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center bg-card rounded-2xl border border-border shadow-sm p-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Ready to experience the future of AI chat?
              </h2>
              <p className="text-muted-foreground mb-6">
                Join thousands of users who have upgraded their AI conversations.
              </p>
              <SignInButton mode="modal">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3">
                  Get Started Now
                </Button>
              </SignInButton>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Loading state for authenticated users
  if (!selectedModel) {
  return (
      <>
      <Head>
        <title>lll.chat</title>
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
            currentThreadId={null}
          onThreadSelect={handleThreadSelect}
              onNewChat={handleNewChat}
              onNavigateToSettings={navigateToSettings}
              onNavigateToAccount={navigateToAccount}
            onNavigateToWelcome={() => {}}
          collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
          onWidthChange={setSidebarWidth}
              onOpenSearch={openSearch}
        />
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots text="Loading" size="lg" />
          </div>
        </main>
      </>
    );
  }

  // Welcome view for authenticated users (new chat)
    return (
      <>
        <Head>
        <title>New Chat - lll.chat</title>
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
          currentThreadId={null}
              onThreadSelect={handleThreadSelect}
              onNewChat={handleNewChat}
              onNavigateToSettings={navigateToSettings}
              onNavigateToAccount={navigateToAccount}
          onNavigateToWelcome={() => {}}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              onWidthChange={setSidebarWidth}
              onOpenSearch={openSearch}
            />
        
        <div className="flex-1">
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
          </div>

          <SearchCommand
            isOpen={isSearchOpen}
            onClose={closeSearch}
            onThreadSelect={handleThreadSelect}
            onNewChat={handleNewChat}
            onNavigateToSettings={navigateToSettings}
            onNavigateToAccount={navigateToAccount}
            onModelChange={handleModelChange}
          currentThreadId={null}
          />
      </main>
      </>
  );
};

export default Home; 