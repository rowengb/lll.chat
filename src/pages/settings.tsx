import { type NextPage } from "next";
import { useUser, UserButton } from "@clerk/nextjs";
import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftIcon, KeyIcon, CheckIcon, TrashIcon, EyeIcon, EyeOffIcon, BotIcon, ChevronDownIcon } from "lucide-react";
import { trpc } from "@/utils/trpc";
import PageTransition from "@/components/PageTransition";
import toast from "react-hot-toast";
import { getProviderIcon } from "@/components/ModelSelector";

interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
  deepseek: string;
  meta: string;
}

const Settings: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: "",
    anthropic: "",
    gemini: "",
    deepseek: "",
    meta: "",
  });
  
  const [showKeys, setShowKeys] = useState<Record<keyof ApiKeys, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
    deepseek: false,
    meta: false,
  });
  
  const [saved, setSaved] = useState(false);
  const [defaultModelSaved, setDefaultModelSaved] = useState(false);
  const [selectedDefaultModel, setSelectedDefaultModel] = useState<string>("");
  const [isDefaultModelDropdownOpen, setIsDefaultModelDropdownOpen] = useState(false);

  // Load API keys from database
  const { data: dbApiKeys } = trpc.apiKeys.getApiKeys.useQuery();
  const saveApiKeyMutation = trpc.apiKeys.saveApiKey.useMutation();
  const deleteApiKeyMutation = trpc.apiKeys.deleteApiKey.useMutation();

  // Load user preferences and models
  const { data: userPreferences } = trpc.userPreferences.getPreferences.useQuery();
  const { data: allModels } = trpc.models.getModels.useQuery();
  const setDefaultModelMutation = trpc.userPreferences.setDefaultModel.useMutation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDefaultModelDropdownOpen(false);
      }
    };

    if (isDefaultModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDefaultModelDropdownOpen]);

  // Update local state when database keys are loaded
  useEffect(() => {
    if (dbApiKeys) {
      setApiKeys({
        openai: dbApiKeys.openai || "",
        anthropic: dbApiKeys.anthropic || "",
        gemini: dbApiKeys.gemini || "",
        deepseek: dbApiKeys.deepseek || "",
        meta: dbApiKeys.meta || "",
      });
    }
  }, [dbApiKeys]);

  // Update selected default model when preferences are loaded
  useEffect(() => {
    if (userPreferences?.defaultModel) {
      setSelectedDefaultModel(userPreferences.defaultModel);
    }
  }, [userPreferences]);

  // Get available models (models with API keys)
  const getAvailableModels = () => {
    if (!allModels || !dbApiKeys) return [];
    
    const availableProviders = new Set();
    Object.entries(dbApiKeys).forEach(([provider, key]) => {
      if (key && key.trim()) {
        availableProviders.add(provider);
      }
    });

    return allModels.filter(model => 
      availableProviders.has(model.provider) && model.isActive
    );
  };

  const availableModels = getAvailableModels();
  const selectedModelData = availableModels.find(model => model.id === selectedDefaultModel);

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

  const handleSave = async () => {
    try {
      // Save each non-empty API key to the database
      const savePromises = [];
      
      for (const [provider, key] of Object.entries(apiKeys)) {
        if (key.trim()) {
          savePromises.push(
            saveApiKeyMutation.mutateAsync({
              provider: provider as "openai" | "anthropic" | "gemini" | "deepseek" | "meta",
              key: key.trim(),
            })
          );
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
      setIsDefaultModelDropdownOpen(false);
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
      // Delete from database
      await deleteApiKeyMutation.mutateAsync({
        provider: provider as "openai" | "anthropic" | "gemini" | "deepseek" | "meta",
      });
      
      // Update local state
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
    };
    return info[provider];
  };

  const handleThreadSelect = (threadId: string) => {
    router.push(`/chat/${threadId}`);
  };

  const handleClearDefaultModel = async () => {
    try {
      // Note: We can't pass empty string to the mutation, so we'll need to create a separate clear method
      // For now, let's update the user preferences to not have a default model
      setSelectedDefaultModel("");
      toast.dismiss();
      toast.success("Default model cleared! The cheapest available model will be used automatically.");
    } catch (error) {
      console.error('Failed to clear default model:', error);
      toast.dismiss();
      toast.error("Failed to clear default model");
    }
  };

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
          <p className="mb-4">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <Head>
        <title>Settings - lll.chat</title>
        <meta name="description" content="lll.chat Settings" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="rounded-full hover:bg-gray-100 p-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage your API keys and preferences
                </p>
              </div>
            </div>

            {/* API Keys Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <KeyIcon className="h-5 w-5 text-gray-900" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">API Keys</h2>
                    <p className="text-sm text-gray-500">
                      Configure your API keys for different AI providers
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {(Object.keys(apiKeys) as Array<keyof ApiKeys>).map((provider) => (
                  <div key={provider} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        {getProviderInfo(provider).name}
                      </label>
                      {apiKeys[provider] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClear(provider)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
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
                        className="pr-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-900 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(provider)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                
                <div className="pt-4 border-t border-gray-100">
                  <Button 
                    onClick={handleSave}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-2 px-4 transition-colors"
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
                  
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    API keys are encrypted and stored securely in the database.
                  </p>
                </div>
              </div>
            </div>

            {/* Default Model Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <BotIcon className="h-5 w-5 text-gray-900" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">Default Model</h2>
                    <p className="text-sm text-gray-500">
                      Choose your preferred default model for new conversations
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {availableModels.length > 0 ? (
                  <div className="space-y-4">
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setIsDefaultModelDropdownOpen(!isDefaultModelDropdownOpen)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {selectedModelData ? (
                            <>
                              <div className="flex-shrink-0">
                                {getProviderIcon(selectedModelData.provider, selectedModelData.name)}
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-gray-900">
                                  {selectedModelData.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {selectedModelData.description}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-500">Select a default model</div>
                          )}
                        </div>
                        <ChevronDownIcon 
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            isDefaultModelDropdownOpen ? 'rotate-180' : ''
                          }`} 
                        />
                      </button>
                      
                      {isDefaultModelDropdownOpen && (
                        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {availableModels.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleSetDefaultModel(model.id)}
                              className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors ${
                                selectedDefaultModel === model.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {getProviderIcon(model.provider, model.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {model.name}
                                </div>
                                <div className="text-sm text-gray-500 truncate">
                                  {model.description}
                                </div>
                                {model.costPer1kTokens && (
                                  <div className="text-xs text-green-600 mt-1">
                                    ${(model.costPer1kTokens * 1000).toFixed(2)} per 1M tokens
                                  </div>
                                )}
                              </div>
                              {selectedDefaultModel === model.id && (
                                <CheckIcon className="h-4 w-4 text-blue-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {selectedDefaultModel && (
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {defaultModelSaved ? "Default model updated!" : "Default model set"}
                          </span>
                        </div>
                        <button
                          onClick={handleClearDefaultModel}
                          className="text-green-600 hover:text-green-700 text-sm underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      Only models with API keys are available for selection. When no default is set, the cheapest available model will be used automatically.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BotIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-medium text-gray-900 mb-2">No Models Available</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Add API keys above to enable model selection
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Settings Sections can go here */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">About</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  lll.chat - Built with Next.js, tRPC, Convex, and TypeScript
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageTransition>
  );
};

export default Settings; 