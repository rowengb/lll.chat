import { type NextPage } from "next";
import { useUser, SignOutButton, UserProfile } from "@clerk/nextjs";
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon, KeyIcon, CheckIcon, TrashIcon, EyeIcon, EyeOffIcon, LogOutIcon, UserIcon, TypeIcon, MessageSquare } from "lucide-react";
import { OpenRouterAvatar } from '@/components/OpenRouterIcon';
import toast from "react-hot-toast";
import { ModelSelector, getProviderIcon } from "@/components/ModelSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoadingDots } from "@/components/LoadingDots";

import { trpc } from "@/utils/trpc";
import { useOpenRouterStore } from '@/stores/openRouterStore';

interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
  deepseek: string;
  meta: string;
  xai: string;
  openrouter: string;
}

const SettingsPage: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { tab } = router.query;

  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: "",
    anthropic: "",
    gemini: "",
    deepseek: "",
    meta: "",
    xai: "",
    openrouter: "",
  });
  const [showKeys, setShowKeys] = useState<Record<keyof ApiKeys, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
    deepseek: false,
    meta: false,
    xai: false,
    openrouter: false,
  });
  const [saved, setSaved] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(false);
  const [selectedDefaultModel, setSelectedDefaultModel] = useState<string>("");
  const [titleGenerationModelSaved, setTitleGenerationModelSaved] = useState(false);
  const [selectedTitleGenerationModel, setSelectedTitleGenerationModel] = useState<string>("");

  const { useOpenRouter, setUseOpenRouter } = useOpenRouterStore();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'api-keys' | 'account'>('account');

  // tRPC queries and mutations
  const { data: dbApiKeys } = trpc.apiKeys.getApiKeys.useQuery();
  const saveApiKeyMutation = trpc.apiKeys.saveApiKey.useMutation();
  const deleteApiKeyMutation = trpc.apiKeys.deleteApiKey.useMutation();
  const { data: userPreferences } = trpc.userPreferences.getPreferences.useQuery();
  const { data: allModels } = trpc.models.getModels.useQuery();
  const setDefaultModelMutation = trpc.userPreferences.setDefaultModel.useMutation();
  const setTitleGenerationModelMutation = trpc.userPreferences.setTitleGenerationModel.useMutation();
  const setOpenRouterModeMutation = trpc.userPreferences.setOpenRouterMode.useMutation();
  const utils = trpc.useUtils();

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tab === 'api-keys') {
      setActiveSettingsTab('api-keys');
    } else {
      setActiveSettingsTab('account');
    }
  }, [tab]);

  // Initialize API keys from database
  useEffect(() => {
    if (dbApiKeys) {
      setApiKeys({
        openai: dbApiKeys.openai || "",
        anthropic: dbApiKeys.anthropic || "",
        gemini: dbApiKeys.gemini || "",
        deepseek: dbApiKeys.deepseek || "",
        meta: dbApiKeys.meta || "",
        xai: dbApiKeys.xai || "",
        openrouter: dbApiKeys.openrouter || "",
      });
    }
  }, [dbApiKeys]);

  // Initialize user preferences
  useEffect(() => {
    if (userPreferences?.defaultModel) {
      setSelectedDefaultModel(userPreferences.defaultModel);
    }
    if ((userPreferences as any)?.titleGenerationModel) {
      setSelectedTitleGenerationModel((userPreferences as any).titleGenerationModel);
    }
  }, [userPreferences]);

  // Sync OpenRouter mode preference from database with Zustand store
  useEffect(() => {
    if (userPreferences && 'useOpenRouter' in userPreferences && userPreferences.useOpenRouter !== undefined) {
      // If database has a preference, use it and update Zustand store
      setUseOpenRouter(userPreferences.useOpenRouter);
    } else if (dbApiKeys) {
      // If no database preference, infer from API keys and save to database
      const hasIndividualKeys = Object.entries(dbApiKeys)
        .filter(([provider]) => provider !== 'openrouter')
        .some(([, key]) => key && key.trim());
      const hasOpenRouterKey = dbApiKeys.openrouter && dbApiKeys.openrouter.trim();
      
      let inferredMode = false;
      
      // If user has OpenRouter key but no individual keys, default to OpenRouter mode
      // If user has individual keys but no OpenRouter key, default to individual mode
      if (hasOpenRouterKey && !hasIndividualKeys) {
        inferredMode = true;
      } else if (hasIndividualKeys && !hasOpenRouterKey) {
        inferredMode = false;
      }
      // If user has both or neither, keep current toggle state (false by default)
      
      setUseOpenRouter(inferredMode);
      
      // Save the inferred preference to database
      setOpenRouterModeMutation.mutate({ useOpenRouter: inferredMode });
    }
  }, [userPreferences, dbApiKeys]);

  // Helper functions
  const getAvailableModels = () => {
    if (!allModels) return [];
    
    // Always show all active models so users can discover what's available
    return allModels.filter(model => model.isActive);
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

  const handleToggleMode = async (newUseOpenRouter: boolean) => {
    try {
      // Update the database preference first
      await setOpenRouterModeMutation.mutateAsync({ useOpenRouter: newUseOpenRouter });
      
      // Then update the local Zustand store
      setUseOpenRouter(newUseOpenRouter);
      
      // Invalidate and refetch all relevant queries to update UI immediately
      utils.userPreferences.getBestDefaultModel.invalidate();
      utils.models.getFavoriteModels.invalidate();
      utils.models.getOtherModels.invalidate();
      utils.models.getModels.invalidate();
      
      // Check if current default model is still available in the new mode
      if (selectedDefaultModel && allModels && dbApiKeys) {
        const currentDefaultModel = allModels.find(model => model.id === selectedDefaultModel);
        
        if (currentDefaultModel) {
          const hasDirectProviderKey = dbApiKeys[currentDefaultModel.provider as keyof typeof dbApiKeys]?.trim();
          const hasOpenRouterSupport = currentDefaultModel.openrouterModelId;
          
          let isModelAvailableInNewMode = false;
          
          if (newUseOpenRouter) {
            // In OpenRouter mode, model needs OpenRouter support (regardless of key presence)
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
      
      // Check if current title generation model is still available in the new mode
      if (selectedTitleGenerationModel && allModels && dbApiKeys) {
        const currentTitleModel = allModels.find(model => model.id === selectedTitleGenerationModel);
        
        if (currentTitleModel) {
          const hasDirectProviderKey = dbApiKeys[currentTitleModel.provider as keyof typeof dbApiKeys]?.trim();
          const hasOpenRouterSupport = currentTitleModel.openrouterModelId;
          
          let isModelAvailableInNewMode = false;
          
          if (newUseOpenRouter) {
            // In OpenRouter mode, model needs OpenRouter support (regardless of key presence)
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
      toast.success(`Switched to ${newUseOpenRouter ? 'OpenRouter' : 'Individual Provider'} mode. ${
        newUseOpenRouter 
          ? 'Models without OpenRouter support or missing OpenRouter key will be disabled.'
          : 'Models without individual API keys will be disabled.'
      }`);
    } catch (error) {
      console.error('Failed to update OpenRouter mode:', error);
      toast.dismiss();
      toast.error("Failed to update OpenRouter mode preference");
    }
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
      
      // Invalidate and refetch all relevant queries to update UI immediately
      utils.apiKeys.getApiKeys.invalidate();
      utils.apiKeys.hasAnyApiKeys.invalidate();
      utils.userPreferences.getBestDefaultModel.invalidate();
      utils.models.getFavoriteModels.invalidate();
      utils.models.getOtherModels.invalidate();
      utils.models.getModels.invalidate();
      
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
      
      // Invalidate and refetch all relevant queries to update UI immediately
      utils.apiKeys.getApiKeys.invalidate();
      utils.apiKeys.hasAnyApiKeys.invalidate();
      utils.userPreferences.getBestDefaultModel.invalidate();
      utils.models.getFavoriteModels.invalidate();
      utils.models.getOtherModels.invalidate();
      utils.models.getModels.invalidate();
      
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
      xai: { name: "xAI", placeholder: "xai-..." },
      openrouter: { name: "OpenRouter", placeholder: "sk-or-..." },
    };
    return info[provider];
  };

  const handleClearDefaultModel = async () => {
    try {
      await setDefaultModelMutation.mutateAsync({ modelId: "" });
      setSelectedDefaultModel("");
      toast.dismiss();
      toast.success("Default model cleared");
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
      await setTitleGenerationModelMutation.mutateAsync({ modelId: "gpt-4o-mini" });
      setSelectedTitleGenerationModel("gpt-4o-mini");
      toast.dismiss();
      toast.success("Title generation model reset to default");
    } catch (error) {
      console.error('Failed to reset title generation model:', error);
      toast.dismiss();
      toast.error("Failed to reset title generation model");
    }
  };

  // Navigation handlers
  const navigateToWelcome = () => {
    router.push('/');
  };

  const switchToAccountTab = () => {
    setActiveSettingsTab('account');
    router.push('/settings?tab=account', undefined, { shallow: true });
  };

  const switchToApiKeysTab = () => {
    setActiveSettingsTab('api-keys');
    router.push('/settings?tab=api-keys', undefined, { shallow: true });
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

  return (
    <>
      <Head>
        <title>Settings - lll.chat</title>
        <meta name="description" content="lll.chat settings - Manage your API keys and preferences" />
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
                              selectedModel={selectedDefaultModel || ""}
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
    </>
  );
};

export default SettingsPage; 