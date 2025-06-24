import { useUser } from "@clerk/nextjs";
import { trpc } from "@/utils/trpc";
import { useMemo } from "react";

/**
 * Centralized data loading hook that eagerly fetches all critical app data
 * This prevents waterfall loading and makes navigation instant
 */
export function useAppData() {
  const { user, isLoaded } = useUser();

  // Eager load all critical data in parallel
  const { data: bestDefaultModel, isLoading: loadingDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery(
    undefined,
    { 
      enabled: !!user,
      staleTime: 60000, // 1 minute
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const { data: threads, isLoading: loadingThreads } = trpc.chat.getThreads.useQuery(
    undefined, 
    {
      enabled: !!user,
      staleTime: 30000, // 30 seconds  
      cacheTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Reduce unnecessary refetches
    }
  );

  const { data: models, isLoading: loadingModels } = trpc.models.getModels.useQuery(
    undefined,
    {
      enabled: !!user,
      staleTime: 300000, // 5 minutes (models don't change often)
      cacheTime: 30 * 60 * 1000, // 30 minutes
    }
  );

  const { data: favoriteModels, isLoading: loadingFavorites } = trpc.models.getFavoriteModels.useQuery(
    undefined,
    {
      enabled: !!user,
      staleTime: 60000, // 1 minute
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const { data: apiKeys, isLoading: loadingApiKeys } = trpc.apiKeys.getApiKeys.useQuery(
    undefined,
    {
      enabled: !!user,
      staleTime: 120000, // 2 minutes
      cacheTime: 15 * 60 * 1000, // 15 minutes
    }
  );

  // Compute derived state
  const selectedModel = useMemo(() => {
    if (bestDefaultModel?.modelId) {
      return bestDefaultModel.modelId;
    }
    return 'gpt-4o'; // Fast fallback
  }, [bestDefaultModel]);

  const isDataLoading = loadingDefaultModel || loadingModels || loadingFavorites || loadingApiKeys;
  const isInitialLoad = !isLoaded || isDataLoading;

  return {
    // Auth
    user,
    isLoaded,
    isAuthenticated: isLoaded && !!user,
    
    // Data
    threads,
    models,
    favoriteModels,
    apiKeys,
    selectedModel,
    bestDefaultModel,
    
    // Loading states
    isDataLoading,
    isInitialLoad,
    loadingStates: {
      defaultModel: loadingDefaultModel,
      threads: loadingThreads,
      models: loadingModels,
      favorites: loadingFavorites,
      apiKeys: loadingApiKeys,
    }
  };
} 