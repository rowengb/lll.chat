import { useEffect, useState, useRef } from 'react';
import { cacheUtils } from '@/utils/performanceOptimizations';

interface UseQueryWithLocalCacheOptions {
  staleTime?: number;
  cacheTime?: number;
  refetchOnMount?: boolean;
}

interface CachedQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: any;
  refetch: () => void;
}

export function useQueryWithLocalCache<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: UseQueryWithLocalCacheOptions = {}
): CachedQueryResult<T> {
  const {
    staleTime = 60000, // 1 minute
    cacheTime = 300000, // 5 minutes
    refetchOnMount = true
  } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [isStale, setIsStale] = useState(false);
  
  const queryRef = useRef<Promise<T> | null>(null);
  const cacheKey = `chat_cache_${queryKey}`;

  // Load cached data immediately
  useEffect(() => {
    const cachedData = cacheUtils.get<T>(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setIsStale(cacheUtils.isStale(cacheKey, staleTime));
    }
  }, [cacheKey, staleTime]);

  const executeQuery = async (skipCache = false) => {
    // Prevent duplicate queries
    if (queryRef.current) {
      return queryRef.current;
    }

    try {
      setError(null);
      
      // Only show loading if we don't have cached data
      if (!data || skipCache) {
        setIsLoading(true);
      }

      const queryPromise = queryFn();
      queryRef.current = queryPromise;
      
      const result = await queryPromise;
      
      // Cache the result
      cacheUtils.set(cacheKey, result, cacheTime);
      
      setData(result);
      setIsStale(false);
      setIsLoading(false);
      
      return result;
    } catch (err) {
      setError(err);
      setIsLoading(false);
      throw err;
    } finally {
      queryRef.current = null;
    }
  };

  // Initial fetch or refetch on mount
  useEffect(() => {
    if (refetchOnMount || !data) {
      executeQuery();
    }
  }, [queryKey, refetchOnMount]);

  // Background refetch if data is stale - DISABLED to prevent cache conflicts
  // useEffect(() => {
  //   if (data && isStale && !isLoading) {
  //     // Background refresh without showing loading state
  //     executeQuery().catch(() => {
  //       // Silently handle background refresh errors
  //     });
  //   }
  // }, [isStale, data, isLoading]);

  const refetch = () => {
    executeQuery(true);
  };

  return {
    data,
    isLoading: isLoading && !data, // Don't show loading if we have cached data
    isStale,
    error,
    refetch
  };
} 