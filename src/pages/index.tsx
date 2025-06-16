import { type NextPage } from "next";
import { useUser, SignInButton, UserProfile, SignOutButton } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { LoadingDots } from "@/components/LoadingDots";
import { useChatStore } from "@/stores/chatStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Waves, MessageSquare, Zap, Shield, Key, ArrowLeftIcon, KeyIcon, CheckIcon, TrashIcon, EyeIcon, EyeOffIcon, LogOutIcon, UserIcon, TypeIcon } from "lucide-react";
import { OpenRouterAvatar } from '@/components/OpenRouterIcon';
import toast from "react-hot-toast";
import { ModelSelector, getProviderIcon } from "@/components/ModelSelector";
import { ThemeToggle } from "@/components/ThemeToggle";

import Logo from '../components/Logo';

import { trpc } from "@/utils/trpc";
import { useOpenRouterStore } from '@/stores/openRouterStore';


interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
  deepseek: string;
  meta: string;
  openrouter: string;
}

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<string | null>(null); // Start with null to indicate loading
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  // Add state to track model choice for new chats (before thread is created)
  const [newChatModelChoice, setNewChatModelChoice] = useState<string | null>(null);
  
  // Add SPA state management for authenticated users
  const [currentView, setCurrentView] = useState<'welcome' | 'chat' | 'settings' | 'account'>('welcome');
  
  const { 
    sidebarCollapsed, 
    sidebarWidth, 
    setSidebarWidth, 
    toggleSidebar 
  } = useChatStore();

  // Settings page state

  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: "",
    anthropic: "",
    gemini: "",
    deepseek: "",
    meta: "",
    openrouter: "",
  });
  const [showKeys, setShowKeys] = useState<Record<keyof ApiKeys, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
    deepseek: false,
    meta: false,
    openrouter: false,
  });
  const [saved, setSaved] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(false);
  const [selectedDefaultModel, setSelectedDefaultModel] = useState<string>("");
  const [titleGenerationModelSaved, setTitleGenerationModelSaved] = useState(false);
  const [selectedTitleGenerationModel, setSelectedTitleGenerationModel] = useState<string>("");

  // Remove local useOpenRouter state and use Zustand store instead
  const { useOpenRouter, setUseOpenRouter } = useOpenRouterStore();
  
  const [activeSettingsTab, setActiveSettingsTab] = useState<'api-keys' | 'account'>('account');

  // Get user's best default model
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery(
    undefined,
    { enabled: !!user } // Only run when user is logged in
  );

  // Get thread data to determine the last used model
  const { data: threads } = trpc.chat.getThreads.useQuery();
  const currentThread = threads?.find(thread => thread.id === currentThreadId);
  const utils = trpc.useUtils();

  // Settings page tRPC queries and mutations
  const { data: dbApiKeys } = trpc.apiKeys.getApiKeys.useQuery();
  const saveApiKeyMutation = trpc.apiKeys.saveApiKey.useMutation();
  const deleteApiKeyMutation = trpc.apiKeys.deleteApiKey.useMutation();
  const { data: userPreferences } = trpc.userPreferences.getPreferences.useQuery();
  const { data: allModels } = trpc.models.getModels.useQuery();
  const setDefaultModelMutation = trpc.userPreferences.setDefaultModel.useMutation();
  const setTitleGenerationModelMutation = trpc.userPreferences.setTitleGenerationModel.useMutation();
  const updateThreadMetadataMutation = trpc.chat.updateThreadMetadata.useMutation();



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

  // Handle URL routing for authenticated users using query parameters
  useEffect(() => {
    if (user) {
      const { view, threadId, tab } = router.query;
      
      if (view === 'chat' && threadId && typeof threadId === 'string') {
        setCurrentView('chat');
        setCurrentThreadId(threadId);
        // Clear new chat model choice when navigating to existing thread
        setNewChatModelChoice(null);
      } else if (view === 'settings') {
        setCurrentView('settings');
        setCurrentThreadId(null);
        // Clear new chat model choice when going to settings
        setNewChatModelChoice(null);
        // Handle tab parameter for settings page
        if (tab === 'api-keys') {
          setActiveSettingsTab('api-keys');
        } else if (tab === 'account') {
          setActiveSettingsTab('account');
        }
      } else if (view === 'account') {
        // Direct account page access - redirect to settings with account tab
        setCurrentView('settings');
        setCurrentThreadId(null);
        // Clear new chat model choice when going to account
        setNewChatModelChoice(null);
        setActiveSettingsTab('account');
      } else {
        setCurrentView('welcome');
        setCurrentThreadId(null);
        // Don't clear newChatModelChoice here - user might be coming back to welcome to create new chat
      }
    }
  }, [router.query, user]);

  // Update selected model when switching threads to remember the last model used in that chat
  useEffect(() => {
    if (currentThread) {
      const threadModel = (currentThread as any).model || currentThread.lastModel;
      console.log(`🔍 [MODEL] Thread ${currentThreadId} data:`, { 
        model: (currentThread as any).model, 
        lastModel: currentThread.lastModel, 
        threadModel, 
        currentSelectedModel: selectedModel,
        newChatModelChoice 
      });
      if (threadModel && threadModel !== selectedModel) {
        console.log(`🔄 [MODEL] Switching to thread model: ${threadModel} (was: ${selectedModel})`);
        setSelectedModel(threadModel);
        // Clear new chat model choice since we're in an existing thread
        setNewChatModelChoice(null);
      }
    } else if (currentThreadId) {
      // Thread ID exists but no thread data yet - this happens during thread creation
      // Don't change the model here! Let it stay as the user selected it
      console.log(`⚠️ [MODEL] No thread data found for threadId: ${currentThreadId} - preserving current model: ${selectedModel}`);
    } else if (!currentThreadId) {
      // We're in welcome view (new chat) - use newChatModelChoice if available, otherwise use default
      if (newChatModelChoice && newChatModelChoice !== selectedModel) {
        console.log(`🆕 [MODEL] Using new chat model choice: ${newChatModelChoice} (was: ${selectedModel})`);
        setSelectedModel(newChatModelChoice);
      } else if (!newChatModelChoice && bestDefaultModel?.modelId && selectedModel !== bestDefaultModel.modelId) {
        console.log(`🏠 [MODEL] Resetting to default model for new chat: ${bestDefaultModel.modelId} (was: ${selectedModel})`);
        setSelectedModel(bestDefaultModel.modelId);
      }
    }
  }, [currentThread, currentThreadId, newChatModelChoice, bestDefaultModel]); // Remove selectedModel from dependencies to prevent infinite loops

  // Settings page useEffect hooks

  useEffect(() => {
    if (dbApiKeys) {
      setApiKeys({
        openai: dbApiKeys.openai || "",
        anthropic: dbApiKeys.anthropic || "",
        gemini: dbApiKeys.gemini || "",
        deepseek: dbApiKeys.deepseek || "",
        meta: dbApiKeys.meta || "",
        openrouter: dbApiKeys.openrouter || "",
      });
    }
  }, [dbApiKeys]);

  useEffect(() => {
    if (userPreferences?.defaultModel) {
      setSelectedDefaultModel(userPreferences.defaultModel);
    }
    if ((userPreferences as any)?.titleGenerationModel) {
      setSelectedTitleGenerationModel((userPreferences as any).titleGenerationModel);
    }
  }, [userPreferences]);

  // Initialize toggle state based on existing API keys
  useEffect(() => {
    if (dbApiKeys) {
      const hasIndividualKeys = Object.entries(dbApiKeys)
        .filter(([provider]) => provider !== 'openrouter')
        .some(([, key]) => key && key.trim());
      const hasOpenRouterKey = dbApiKeys.openrouter && dbApiKeys.openrouter.trim();
      
      // If user has OpenRouter key but no individual keys, default to OpenRouter mode
      // If user has individual keys but no OpenRouter key, default to individual mode
      // If user has both, keep current toggle state
      if (hasOpenRouterKey && !hasIndividualKeys) {
        setUseOpenRouter(true);
      } else if (hasIndividualKeys && !hasOpenRouterKey) {
        setUseOpenRouter(false);
      }
      // If user has both or neither, keep current toggle state
    }
  }, [dbApiKeys]);

  // Settings page helper functions
  const getAvailableModels = () => {
    if (!allModels || !dbApiKeys) return [];
    
    const availableProviders = new Set();
    const hasOpenRouterKey = dbApiKeys.openrouter && dbApiKeys.openrouter.trim();
    
    Object.entries(dbApiKeys).forEach(([provider, key]) => {
      if (key && key.trim()) {
        availableProviders.add(provider);
      }
    });

    return allModels.filter(model => {
      if (!model.isActive) return false;
      
      if (useOpenRouter) {
        // In OpenRouter mode, only show models with OpenRouter support
        return hasOpenRouterKey && model.openrouterModelId;
      } else {
        // In individual mode, only show models with direct provider keys
        return availableProviders.has(model.provider);
      }
    });
  };

  const availableModels = useMemo(() => getAvailableModels(), [allModels, dbApiKeys, useOpenRouter]);
  const selectedModelData = availableModels.find((model: any) => model.id === selectedDefaultModel);

  const handleKeyChange = (provider: keyof ApiKeys, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }));
  };

  const toggleKeyVisibility = (provider: keyof ApiKeys) => {
    setShowKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const handleToggleMode = (newUseOpenRouter: boolean) => {
    setUseOpenRouter(newUseOpenRouter);
    
    // Check if current default model is still available in the new mode
    if (selectedDefaultModel && allModels && dbApiKeys) {
      const currentDefaultModel = allModels.find(model => model.id === selectedDefaultModel);
      
      if (currentDefaultModel) {
        const hasDirectProviderKey = dbApiKeys[currentDefaultModel.provider as keyof typeof dbApiKeys]?.trim();
        const hasOpenRouterSupport = dbApiKeys.openrouter?.trim() && currentDefaultModel.openrouterModelId;
        
        let isModelAvailableInNewMode = false;
        
        if (newUseOpenRouter) {
          // In OpenRouter mode, model needs OpenRouter support
          isModelAvailableInNewMode = !!hasOpenRouterSupport;
        } else {
          // In individual mode, model needs direct provider key
          isModelAvailableInNewMode = !!hasDirectProviderKey;
        }
        
        // If current default model is not available in new mode, reset it
        if (!isModelAvailableInNewMode) {
          setSelectedDefaultModel("");
        }
      }
    }
    
    // Check if current selected chat model is still available in the new mode
    if (selectedModel && allModels && dbApiKeys) {
      const currentSelectedModel = allModels.find(model => model.id === selectedModel);
      
      if (currentSelectedModel) {
        const hasDirectProviderKey = dbApiKeys[currentSelectedModel.provider as keyof typeof dbApiKeys]?.trim();
        const hasOpenRouterSupport = dbApiKeys.openrouter?.trim() && currentSelectedModel.openrouterModelId;
        
        let isModelAvailableInNewMode = false;
        
        if (newUseOpenRouter) {
          // In OpenRouter mode, model needs OpenRouter support
          isModelAvailableInNewMode = !!hasOpenRouterSupport;
        } else {
          // In individual mode, model needs direct provider key
          isModelAvailableInNewMode = !!hasDirectProviderKey;
        }
        
        // If current selected model is not available in new mode, reset to best available
        if (!isModelAvailableInNewMode) {
          // Find the best available model in the new mode
          const availableModelsInNewMode = allModels.filter(model => {
            if (!model.isActive) return false;
            
            const modelHasDirectKey = dbApiKeys[model.provider as keyof typeof dbApiKeys]?.trim();
            const modelHasOpenRouterSupport = dbApiKeys.openrouter?.trim() && model.openrouterModelId;
            
            if (newUseOpenRouter) {
              return !!modelHasOpenRouterSupport;
            } else {
              return !!modelHasDirectKey;
            }
          });
          
          // Set to the first available model (usually the cheapest/default)
          if (availableModelsInNewMode.length > 0 && availableModelsInNewMode[0]) {
            setSelectedModel(availableModelsInNewMode[0].id);
          }
        }
      }
    }
    
    // Check if current title generation model is still available in the new mode
    if (selectedTitleGenerationModel && allModels && dbApiKeys) {
      const currentTitleModel = allModels.find(model => model.id === selectedTitleGenerationModel);
      
      if (currentTitleModel) {
        const hasDirectProviderKey = dbApiKeys[currentTitleModel.provider as keyof typeof dbApiKeys]?.trim();
        const hasOpenRouterSupport = dbApiKeys.openrouter?.trim() && currentTitleModel.openrouterModelId;
        
        let isModelAvailableInNewMode = false;
        
        if (newUseOpenRouter) {
          // In OpenRouter mode, model needs OpenRouter support
          isModelAvailableInNewMode = !!hasOpenRouterSupport;
        } else {
          // In individual mode, model needs direct provider key
          isModelAvailableInNewMode = !!hasDirectProviderKey;
        }
        
        // If current title generation model is not available in new mode, reset it
        if (!isModelAvailableInNewMode) {
          setSelectedTitleGenerationModel("");
        }
      }
    }
    
    toast.dismiss();
    const newAvailableModels = getAvailableModels();
    toast.success(`Switched to ${newUseOpenRouter ? 'OpenRouter' : 'Individual Provider'} mode${
      (selectedDefaultModel && newAvailableModels && !newAvailableModels.find(m => m.id === selectedDefaultModel)) ||
      (selectedModel && newAvailableModels && !newAvailableModels.find(m => m.id === selectedModel))
        ? '. Models updated to match available options.'
        : ''
    }`);
  };

  const handleSave = async () => {
    try {
      const savePromises = [];
      
      if (useOpenRouter) {
        // Only save OpenRouter key
        if (apiKeys.openrouter.trim()) {
          savePromises.push(
            saveApiKeyMutation.mutateAsync({
              provider: "openrouter",
              key: apiKeys.openrouter.trim(),
            })
          );
        }
      } else {
        // Only save individual provider keys
        for (const [provider, key] of Object.entries(apiKeys)) {
          if (provider !== 'openrouter' && key.trim()) {
            savePromises.push(
              saveApiKeyMutation.mutateAsync({
                provider: provider as "openai" | "anthropic" | "gemini" | "deepseek" | "meta",
                key: key.trim(),
              })
            );
          }
        }
      }
      
      await Promise.all(savePromises);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.dismiss();
      toast.success("API keys saved successfully!");
    } catch (error) {
      console.error('Failed to save API keys:', error);
      toast.dismiss();
      toast.error("Failed to save API keys");
    }
  };

  const handleSetDefaultModel = async (modelId: string) => {
    try {
      await setDefaultModelMutation.mutateAsync({ modelId });
      setSelectedDefaultModel(modelId);
      setDefaultModelSaved(true);
      setTimeout(() => setDefaultModelSaved(false), 2000);

      toast.dismiss();
      toast.success("Default model updated!");
    } catch (error) {
      console.error('Failed to set default model:', error);
      toast.dismiss();
      toast.error("Failed to set default model");
    }
  };

  const handleClear = async (provider: keyof ApiKeys) => {
    try {
      await deleteApiKeyMutation.mutateAsync({
        provider: provider as "openai" | "anthropic" | "gemini" | "deepseek" | "meta",
      });
      
      setApiKeys(prev => ({
        ...prev,
        [provider]: ""
      }));
      toast.dismiss();
      toast.success(`${getProviderInfo(provider).name} API key cleared`);
    } catch (error) {
      console.error('Failed to clear API key:', error);
      toast.dismiss();
      toast.error("Failed to clear API key");
    }
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "*".repeat(key.length);
    return key.slice(0, 4) + "*".repeat(Math.max(0, key.length - 8)) + key.slice(-4);
  };

  const getProviderInfo = (provider: keyof ApiKeys) => {
    const info = {
      openai: { name: "OpenAI", placeholder: "sk-..." },
      anthropic: { name: "Anthropic", placeholder: "sk-ant-..." },
      gemini: { name: "Google Gemini", placeholder: "AI..." },
      deepseek: { name: "DeepSeek", placeholder: "sk-..." },
      meta: { name: "Meta (Llama)", placeholder: "..." },
      openrouter: { name: "OpenRouter", placeholder: "sk-or-..." },
    };
    return info[provider];
  };

  const handleClearDefaultModel = async () => {
    try {
      setSelectedDefaultModel("");
      toast.dismiss();
      toast.success("Default model cleared! The cheapest available model will be used automatically.");
    } catch (error) {
      console.error('Failed to clear default model:', error);
      toast.dismiss();
      toast.error("Failed to clear default model");
    }
  };

  const handleSetTitleGenerationModel = async (modelId: string) => {
    try {
      await setTitleGenerationModelMutation.mutateAsync({ modelId });
      setSelectedTitleGenerationModel(modelId);
      setTitleGenerationModelSaved(true);
      setTimeout(() => setTitleGenerationModelSaved(false), 2000);

      toast.dismiss();
      toast.success("Title generation model updated!");
    } catch (error) {
      console.error('Failed to set title generation model:', error);
      toast.dismiss();
      toast.error("Failed to set title generation model");
    }
  };

  const handleClearTitleGenerationModel = async () => {
    try {
      await setTitleGenerationModelMutation.mutateAsync({ modelId: "gpt-4o-mini" }); // Reset to default
      setSelectedTitleGenerationModel("");
      setTitleGenerationModelSaved(false);
      toast.dismiss();
      toast.success("Title generation model reset to default!");
    } catch (error) {
      console.error('Failed to clear title generation model:', error);
      toast.dismiss();
      toast.error("Failed to clear title generation model");
    }
  };

  // Navigation functions that update URL without page refresh using query parameters
  const navigateToWelcome = () => {
    setCurrentView('welcome');
    setCurrentThreadId(null);
    router.push('/', undefined, { shallow: true });
  };

  const navigateToChat = (threadId: string) => {
    setCurrentView('chat');
    setCurrentThreadId(threadId);
    router.push(`/?view=chat&threadId=${threadId}`, undefined, { shallow: true });
  };

  const navigateToSettings = () => {
    setCurrentView('settings');
    setCurrentThreadId(null);
    setActiveSettingsTab('api-keys'); // Switch to API keys tab
    router.push('/?view=settings&tab=api-keys', undefined, { shallow: true });
  };

  const navigateToAccount = () => {
    setCurrentView('settings');
    setCurrentThreadId(null);
    setActiveSettingsTab('account'); // Switch to account tab
    router.push('/?view=settings&tab=account', undefined, { shallow: true });
  };

  // Functions to handle tab switching with URL updates
  const switchToAccountTab = () => {
    setActiveSettingsTab('account');
    router.push('/?view=settings&tab=account', undefined, { shallow: true });
  };

  const switchToApiKeysTab = () => {
    setActiveSettingsTab('api-keys');
    router.push('/?view=settings&tab=api-keys', undefined, { shallow: true });
  };

  const handleThreadSelect = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleThreadCreate = (threadId: string) => {
    navigateToChat(threadId);
  };

  const handleNewChat = () => {
    // Clear any previous new chat model choice and reset to default
    setNewChatModelChoice(null);
    // Reset to default model for new chat
    if (bestDefaultModel?.modelId) {
      setSelectedModel(bestDefaultModel.modelId);
    }
    navigateToWelcome();
  };

  // Custom model change handler that persists the selection to the current thread
  const handleModelChange = async (modelId: string) => {
    console.log(`🎯 [MODEL] User changed model to: ${modelId} (thread: ${currentThreadId})`);
    setSelectedModel(modelId);
    
    // If we're in a chat thread, update the thread's lastModel
    if (currentThreadId) {
      try {
        await updateThreadMetadataMutation.mutateAsync({
          threadId: currentThreadId,
          lastModel: modelId,
        });
        console.log(`✅ [MODEL] Successfully updated thread ${currentThreadId} lastModel to: ${modelId}`);
        
        // Invalidate threads cache to immediately update the UI with the new model
        utils.chat.getThreads.invalidate();
      } catch (error) {
        console.error('Failed to update thread model:', error);
        // Don't show error to user as this is not critical
      }
    } else {
      // We're in welcome view (new chat) - store the model choice for when thread is created
      console.log(`🆕 [MODEL] Storing new chat model choice: ${modelId}`);
      setNewChatModelChoice(modelId);
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'chat':
        if (currentThread?.title) {
          return `lll.chat — ${currentThread.title}`;
        }
        return 'lll.chat — Chat';
      case 'settings':
        return activeSettingsTab === 'account' ? 'lll.chat — Account' : 'lll.chat — Settings';
      case 'account':
        return 'lll.chat — Account';
      default:
        return 'lll.chat — New Chat';
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'chat':
        if (user && selectedModel) {
          return (
            <ChatWindow 
              threadId={currentThreadId}
              onThreadCreate={handleThreadCreate}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={sidebarWidth}
              onToggleSidebar={toggleSidebar}
              currentView={currentView}
              onNavigateToSettings={navigateToSettings}
            />
          );
        }
        // Show loading state instead of null to prevent flashing
        return (
          <div 
            className="flex-1 flex items-center justify-center"
            style={{ 
              marginLeft: sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
              transition: 'margin-left 0.2s ease-in-out'
            }}
          >
            <LoadingDots text="Loading chat" size="lg" />
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 overflow-y-auto">
            <main className="min-h-screen bg-background">
              <div className="max-w-4xl mx-auto px-6 py-8 pb-16">
                <div className="space-y-8">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateToWelcome}
                      className="rounded-full hover:bg-muted p-2"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </Button>
                    <div>
                      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manage your API keys, account, and preferences
                      </p>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm">
                    <div className="p-6 pb-0">
                      <nav className="flex space-x-2 bg-muted rounded-xl p-1" aria-label="Tabs">
                        <button
                          onClick={switchToAccountTab}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeSettingsTab === 'account'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            Account
                          </div>
                        </button>
                        <button
                          onClick={switchToApiKeysTab}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeSettingsTab === 'api-keys'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <KeyIcon className="h-4 w-4" />
                            API Keys
                          </div>
                        </button>
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeSettingsTab === 'account' ? (
                        <div className="space-y-6">
                          {/* Account Content */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-lg font-medium text-foreground">Account Settings</h2>
                              <p className="text-sm text-muted-foreground mt-1">
                                Manage your account settings and preferences
                              </p>
                            </div>
                            <SignOutButton>
                              <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <LogOutIcon className="h-4 w-4" />
                                Sign Out
                              </Button>
                            </SignOutButton>
                          </div>

                          {/* Theme Toggle */}
                          <div className="pt-6 border-t border-border">
                            <ThemeToggle />
                          </div>

                          {/* Profile Management */}
                          <div className="pt-6 border-t border-border">
                            <div className="mb-4">
                              <h3 className="text-lg font-medium text-foreground mb-2">Profile Management</h3>
                              <p className="text-sm text-muted-foreground">
                                Manage your profile, security settings, and connected accounts
                              </p>
                            </div>
                            
                            <div className="w-full">
                              <UserProfile 
                                routing="hash"
                                appearance={{
                                  elements: {
                                    rootBox: {
                                      boxShadow: "none !important",
                                      width: "100%",
                                      maxWidth: "none",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "0.75rem"
                                    },
                                    card: {
                                      boxShadow: "none !important",
                                      width: "100%",
                                      maxWidth: "none",
                                      border: "none"
                                    },
                                    cardBox: {
                                      boxShadow: "none !important",
                                      width: "100%",
                                      maxWidth: "none",
                                      border: "none"
                                    },
                                    main: {
                                      boxShadow: "none !important",
                                      width: "100%",
                                      border: "none"
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* API Keys Content */}
                          <div>
                            <h2 className="text-lg font-medium text-foreground mb-2">API Keys</h2>
                            <p className="text-sm text-muted-foreground mb-6">
                              Configure your API keys for different AI providers
                            </p>
                          </div>

                          {/* Mode Toggle */}
                          <div className="p-4 bg-muted/50 border border-border rounded-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 flex items-center gap-3">
                                {useOpenRouter && (
                                  <OpenRouterAvatar size={32} />
                                )}
                                <div>
                                  <h3 className="text-sm font-medium text-foreground mb-1">
                                    {useOpenRouter ? 'OpenRouter Mode' : 'Individual Provider Mode'}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {useOpenRouter 
                                      ? 'Use one OpenRouter key to access all supported models' 
                                      : 'Use individual API keys for each provider'
                                    }
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium ${!useOpenRouter ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  Individual
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleMode(!useOpenRouter)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                    useOpenRouter ? 'bg-primary' : 'bg-muted-foreground/20'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      useOpenRouter ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                                <span className={`text-xs font-medium ${useOpenRouter ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  OpenRouter
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-6">
                            {(Object.keys(apiKeys) as Array<keyof ApiKeys>)
                              .filter(provider => useOpenRouter ? provider === 'openrouter' : provider !== 'openrouter')
                              .map((provider) => (
                              <div key={provider} className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-foreground">
                                    {getProviderInfo(provider).name}
                                  </label>
                                  {apiKeys[provider] && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleClear(provider)}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                <div className="relative">
                                  <Input
                                    type={showKeys[provider] ? "text" : "password"}
                                    placeholder={getProviderInfo(provider).placeholder}
                                    value={showKeys[provider] ? apiKeys[provider] : maskKey(apiKeys[provider])}
                                    onChange={(e) => handleKeyChange(provider, e.target.value)}
                                    onFocus={() => setShowKeys(prev => ({ ...prev, [provider]: true }))}
                                    onBlur={() => setShowKeys(prev => ({ ...prev, [provider]: false }))}
                                    className="pr-12 bg-muted border-border focus:bg-background focus:border-ring transition-colors"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleKeyVisibility(provider)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {showKeys[provider] ? (
                                      <EyeOffIcon className="h-4 w-4" />
                                    ) : (
                                      <EyeIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            <div className="pt-4 border-t border-border">
                              <Button 
                                onClick={handleSave}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-2 px-4 transition-colors"
                              >
                                {saved ? (
                                  <span className="flex items-center gap-2">
                                    <CheckIcon className="h-4 w-4" />
                                    Saved!
                                  </span>
                                ) : (
                                  "Save API Keys"
                                )}
                              </Button>
                              
                              <p className="text-xs text-muted-foreground mt-3 text-center">
                                API keys are encrypted and stored securely in the database.
                              </p>
                            </div>
                          </div>

                          {/* Default Chat Model Section */}
                          <div className="pt-6 border-t border-border">
                            <div className="mb-4">
                              <h3 className="text-lg font-medium text-foreground mb-2 flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-black dark:text-primary" />
                                Default Chat Model
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Choose your preferred AI model for new conversations
                              </p>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="px-4 py-2 border border-border rounded-xl bg-muted">
                                <ModelSelector
                                  selectedModel={selectedDefaultModel || selectedModel || ""}
                                  onModelChange={handleSetDefaultModel}
                                  size="lg"
                                />
                              </div>
                              
                              {selectedDefaultModel && (
                                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl">
                                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <CheckIcon className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                      {defaultModelSaved ? "Default model updated!" : "Default model set"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={handleClearDefaultModel}
                                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm underline"
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground">
                                Only models with API keys are available for selection. When no default is set, the cheapest available model will be used automatically.
                              </p>
                            </div>
                          </div>

                          {/* Title Generation Model Section */}
                          <div className="pt-6 border-t border-border">
                            <div className="mb-4">
                              <h3 className="text-lg font-medium text-foreground mb-2 flex items-center gap-2">
                                <TypeIcon className="h-5 w-5 text-black dark:text-primary" />
                                Default Title Generation Model
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Choose the AI model used to automatically generate chat titles
                              </p>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="px-4 py-2 border border-border rounded-xl bg-muted">
                                <ModelSelector
                                  selectedModel={selectedTitleGenerationModel || "gpt-4o-mini"}
                                  onModelChange={handleSetTitleGenerationModel}
                                  size="lg"
                                />
                              </div>
                              
                              {selectedTitleGenerationModel && (
                                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl">
                                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <CheckIcon className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                      {titleGenerationModelSaved ? "Title generation model updated!" : "Title generation model set"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={handleClearTitleGenerationModel}
                                    className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm underline"
                                  >
                                    Reset to Default
                                  </button>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground">
                                This model will be used to automatically generate descriptive titles for your conversations. Defaults to GPT-4o Mini for cost efficiency.
                              </p>
                            </div>
                          </div>


                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        );
      case 'account':
        // Redirect to settings with account tab
        setCurrentView('settings');
        setActiveSettingsTab('account');
        return null;
      default: // welcome
        if (user && selectedModel) {
          return (
            <ChatWindow 
              threadId={null}
              onThreadCreate={handleThreadCreate}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              sidebarCollapsed={sidebarCollapsed}
              sidebarWidth={sidebarWidth}
              onToggleSidebar={toggleSidebar}
              currentView={currentView}
              onNavigateToSettings={navigateToSettings}
            />
          );
        }
        // Show loading state instead of null to prevent flashing
        return (
          <div 
            className="flex-1 flex items-center justify-center"
            style={{ 
              marginLeft: sidebarCollapsed ? '0px' : `${sidebarWidth}px`,
              transition: 'margin-left 0.2s ease-in-out'
            }}
          >
            <LoadingDots text="Loading" size="lg" className="text-gray-500" />
          </div>
        );
    }
  };

  // For authenticated users, we'll render the SPA directly instead of redirecting

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
        
        {/* Simple loading text */}
        <main className="h-screen flex items-center justify-center">
          <LoadingDots text="Loading" size="lg" />
        </main>
      </>
    );
  }

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

            {/* Our Stack */}
            <div className="text-center mb-16">
              <h2 className="text-2xl font-semibold text-foreground mb-8">Our Stack</h2>
              <div className="bg-card rounded-2xl border border-border p-8 w-full">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center justify-items-center">
                {/* Next.js */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <mask id="mask0_408_139" style={{maskType:"alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
                        <circle cx="90" cy="90" r="90" fill="black"/>
                      </mask>
                      <g mask="url(#mask0_408_139)">
                        <circle cx="90" cy="90" r="87" fill="black" stroke="white" strokeWidth="6"/>
                        <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#paint0_linear_408_139)"/>
                        <rect x="115" y="54" width="12" height="72" fill="url(#paint1_linear_408_139)"/>
                      </g>
                      <defs>
                        <linearGradient id="paint0_linear_408_139" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
                          <stop stopColor="white"/>
                          <stop offset="1" stopColor="white" stopOpacity="0"/>
                        </linearGradient>
                        <linearGradient id="paint1_linear_408_139" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
                          <stop stopColor="white"/>
                          <stop offset="1" stopColor="white" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Next.js</span>
                </div>

                {/* TypeScript */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg viewBox="0 0 256 256" width="48" height="48" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                      <path d="M20 0h216c11.046 0 20 8.954 20 20v216c0 11.046-8.954 20-20 20H20c-11.046 0-20-8.954-20-20V20C0 8.954 8.954 0 20 0Z" fill="#3178C6"/>
                      <path d="M150.518 200.475v27.62c4.492 2.302 9.805 4.028 15.938 5.179 6.133 1.151 12.597 1.726 19.393 1.726 6.622 0 12.914-.633 18.874-1.899 5.96-1.266 11.187-3.352 15.678-6.257 4.492-2.906 8.048-6.704 10.669-11.394 2.62-4.689 3.93-10.486 3.93-17.391 0-5.006-.749-9.394-2.246-13.163a30.748 30.748 0 0 0-6.479-10.055c-2.821-2.935-6.205-5.567-10.149-7.898-3.945-2.33-8.394-4.531-13.347-6.602-3.628-1.497-6.881-2.949-9.761-4.359-2.879-1.41-5.327-2.848-7.342-4.316-2.016-1.467-3.571-3.021-4.665-4.661-1.094-1.64-1.641-3.495-1.641-5.567 0-1.899.489-3.61 1.468-5.135s2.362-2.834 4.147-3.927c1.785-1.094 3.973-1.942 6.565-2.547 2.591-.604 5.471-.906 8.638-.906 2.304 0 4.737.173 7.299.518 2.563.345 5.14.877 7.732 1.597a53.669 53.669 0 0 1 7.558 2.719 41.7 41.7 0 0 1 6.781 3.797v-25.807c-4.204-1.611-8.797-2.805-13.778-3.582-4.981-.777-10.697-1.165-17.147-1.165-6.565 0-12.784.705-18.658 2.115-5.874 1.409-11.043 3.61-15.506 6.602-4.463 2.993-7.99 6.805-10.582 11.437-2.591 4.632-3.887 10.17-3.887 16.615 0 8.228 2.375 15.248 7.127 21.06 4.751 5.811 11.963 10.731 21.638 14.759a291.458 291.458 0 0 1 10.625 4.575c3.283 1.496 6.119 3.049 8.509 4.66 2.39 1.611 4.276 3.366 5.658 5.265 1.382 1.899 2.073 4.057 2.073 6.474a9.901 9.901 0 0 1-1.296 4.963c-.863 1.524-2.174 2.848-3.93 3.97-1.756 1.122-3.945 1.999-6.565 2.632-2.62.633-5.687.95-9.2.95-5.989 0-11.92-1.05-17.794-3.151-5.875-2.1-11.317-5.25-16.327-9.451Zm-46.036-68.733H140V109H41v22.742h35.345V233h28.137V131.742Z" fill="#FFF"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">TypeScript</span>
                </div>

                {/* tRPC */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 512 512">
                      <rect width="512" height="512" fill="#398CCB" rx="150"/>
                      <path fill="#fff" fillRule="evenodd" d="m255.446 75 71.077 41.008v22.548l86.031 49.682v84.986l23.077 13.322v82.062L364.6 409.615l-31.535-18.237-76.673 44.268-76.214-44.012-31.093 17.981-71.031-41.077v-81.992l22.177-12.803v-85.505l84.184-48.6.047-.002v-23.628L255.446 75Zm71.077 84.879v38.144l-71.031 41.008-71.03-41.008v-37.087l-.047.002-65.723 37.962v64.184l30.393-17.546 71.03 41.008v81.992l-21.489 12.427 57.766 33.358 58.226-33.611-21.049-12.174v-81.992l71.031-41.008 29.492 17.027V198.9l-67.569-39.021Zm-14.492 198.09v-50.054l43.338 25.016v50.054l-43.338-25.016Zm105.138-50.123-43.338 25.016v50.123l43.338-25.085v-50.054ZM96.515 357.9v-50.054l43.339 25.016v50.053L96.515 357.9Zm105.139-50.054-43.339 25.016v50.053l43.339-25.015v-50.054Zm119.608-15.923 43.338-25.015 43.338 25.015-43.338 25.039-43.338-25.039Zm-172.177-25.085-43.339 25.085 43.339 24.969 43.338-24.969-43.338-25.085Zm53.838-79.476v-50.054l43.292 25.038v50.031l-43.292-25.015Zm105.092-50.054-43.292 25.038v50.008l43.292-24.992v-50.054Zm-95.861-15.97 43.292-25.015 43.339 25.015-43.339 25.016-43.292-25.016Z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">tRPC</span>
                </div>

                {/* Tailwind CSS */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 54 33" width="48" height="29">
                      <g clipPath="url(#a)">
                        <path fill="#38bdf8" fillRule="evenodd" d="M27 0c-7.2 0-11.7 3.6-13.5 10.8 2.7-3.6 5.85-4.95 9.45-4.05 2.054.513 3.522 2.004 5.147 3.653C30.744 13.09 33.808 16.2 40.5 16.2c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C36.756 3.11 33.692 0 27 0zM13.5 16.2C6.3 16.2 1.8 19.8 0 27c2.7-3.6 5.85-4.95 9.45-4.05 2.054.514 3.522 2.004 5.147 3.653C17.244 29.29 20.308 32.4 27 32.4c7.2 0 11.7-3.6 13.5-10.8-2.7 3.6-5.85 4.95-9.45 4.05-2.054-.513-3.522-2.004-5.147-3.653C23.256 19.31 20.192 16.2 13.5 16.2z" clipRule="evenodd"/>
                      </g>
                      <defs>
                        <clipPath id="a">
                          <path fill="#fff" d="M0 0h54v32.4H0z"/>
                        </clipPath>
                      </defs>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Tailwind</span>
                </div>

                {/* Convex */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg viewBox="28 28 128 132" xmlns="http://www.w3.org/2000/svg" fill="none" width="48" height="50">
                      <path fill="#F3B01C" d="M108.092 130.021c18.166-2.018 35.293-11.698 44.723-27.854-4.466 39.961-48.162 65.218-83.83 49.711-3.286-1.425-6.115-3.796-8.056-6.844-8.016-12.586-10.65-28.601-6.865-43.135 10.817 18.668 32.81 30.111 54.028 28.122Z"/>
                      <path fill="#8D2676" d="M53.401 90.174c-7.364 17.017-7.682 36.94 1.345 53.336-31.77-23.902-31.423-75.052-.388-98.715 2.87-2.187 6.282-3.485 9.86-3.683 14.713-.776 29.662 4.91 40.146 15.507-21.3.212-42.046 13.857-50.963 33.555Z"/>
                      <path fill="#EE342F" d="M114.637 61.855C103.89 46.87 87.069 36.668 68.639 36.358c35.625-16.17 79.446 10.047 84.217 48.807.444 3.598-.139 7.267-1.734 10.512-6.656 13.518-18.998 24.002-33.42 27.882 10.567-19.599 9.263-43.544Z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Convex</span>
                </div>

                {/* Clerk */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-background rounded-2xl border border-border shadow-sm flex items-center justify-center">
                    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="48" width="48">
                      <path d="m21.47 20.829 -2.881 -2.881a0.572 0.572 0 0 0 -0.7 -0.084 6.854 6.854 0 0 1 -7.081 0 0.576 0.576 0 0 0 -0.7 0.084l-2.881 2.881a0.576 0.576 0 0 0 -0.103 0.69 0.57 0.57 0 0 0 0.166 0.186 12 12 0 0 0 14.113 0 0.58 0.58 0 0 0 0.239 -0.423 0.576 0.576 0 0 0 -0.172 -0.453Zm0.002 -17.668 -2.88 2.88a0.569 0.569 0 0 1 -0.701 0.084A6.857 6.857 0 0 0 8.724 8.08a6.862 6.862 0 0 0 -1.222 3.692 6.86 6.86 0 0 0 0.978 3.764 0.573 0.573 0 0 1 -0.083 0.699l-2.881 2.88a0.567 0.567 0 0 1 -0.864 -0.063A11.993 11.993 0 0 1 6.771 2.7a11.99 11.99 0 0 1 14.637 -0.405 0.566 0.566 0 0 1 0.232 0.418 0.57 0.57 0 0 1 -0.168 0.448Zm-7.118 12.261a3.427 3.427 0 1 0 0 -6.854 3.427 3.427 0 0 0 0 6.854Z" fill="#111" strokeWidth="1"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Clerk</span>
                </div>
                </div>
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

  // For authenticated users, show sidebar layout even while loading selectedModel
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
        <div className={`${currentView === 'settings' ? 'hidden' : ''}`}>
        <Sidebar 
              currentThreadId={currentThreadId}
          onThreadSelect={handleThreadSelect}
              onNewChat={handleNewChat}
              onNavigateToSettings={navigateToSettings}
              onNavigateToAccount={navigateToAccount}
              onNavigateToWelcome={navigateToWelcome}
          collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
          onWidthChange={setSidebarWidth}
        />
        </div>
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots text="Loading" size="lg" />
          </div>
        </main>
      </>
    );
  }

  // Only render authenticated content when selectedModel is available
  if (user && selectedModel) {
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
          {/* Sidebar - Hidden with CSS on settings page to preserve width */}
          <div className={`${currentView === 'settings' ? 'hidden' : ''}`}>
            <Sidebar 
              currentThreadId={currentThreadId}
              onThreadSelect={handleThreadSelect}
              onNewChat={handleNewChat}
              onNavigateToSettings={navigateToSettings}
              onNavigateToAccount={navigateToAccount}
              onNavigateToWelcome={navigateToWelcome}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              onWidthChange={setSidebarWidth}
            />
          </div>
          
          {/* Content Area - swaps based on currentView */}
          <div className="flex-1 transition-opacity duration-200 ease-in-out">
            {renderContent()}
          </div>
      </main>
      </>
    );
  }

  // Fallback for any other case
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingDots text="Loading" size="lg" />
    </div>
  );
};

export default Home; 