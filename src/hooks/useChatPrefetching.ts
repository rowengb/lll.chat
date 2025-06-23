import { useCallback, useEffect, useRef, useMemo } from 'react';
import { trpc } from '@/utils/trpc';
import { debounce, performanceMonitor } from '@/utils/performanceOptimizations';

interface UseChatPrefetchingOptions {
  hoverDelay?: number;
  mousedownDelay?: number;
  enabled?: boolean;
  aggressiveMode?: boolean;
  batchSize?: number;
}

interface PrefetchCache {
  [key: string]: {
    timestamp: number;
    promise: Promise<any>;
    priority: 'high' | 'medium' | 'low';
  };
}

export function useChatPrefetching(options: UseChatPrefetchingOptions = {}) {
  const {
    hoverDelay = 200,
    mousedownDelay = 0,
    enabled = true,
    aggressiveMode = true,
    batchSize = 3
  } = options;

  const utils = trpc.useUtils();
  const prefetchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prefetchCache = useRef<PrefetchCache>({});
  const intersectionObserver = useRef<IntersectionObserver | null>(null);
  const lastPrefetchTime = useRef<number>(0);

  // Performance monitoring
  const prefetchStats = useRef({
    hits: 0,
    misses: 0,
    totalPrefetches: 0,
    avgPrefetchTime: 0
  });

  // Clean up timeouts and cache on unmount
  useEffect(() => {
    return () => {
      prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout));
      prefetchTimeouts.current.clear();
      
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
      
      // Clear expired cache entries
      const now = Date.now();
      Object.keys(prefetchCache.current).forEach(key => {
        const entry = prefetchCache.current[key];
        if (entry && now - entry.timestamp > 300000) { // 5 minutes
          delete prefetchCache.current[key];
        }
      });
    };
  }, []);

  // Intelligent prefetch with caching and deduplication
  const prefetchThread = useCallback(async (threadId: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    if (!enabled || !threadId) return;

    const cacheKey = `thread-${threadId}`;
    const now = Date.now();

    // Check if already cached and fresh (within 2 minutes for high priority, 5 for others)
    const maxAge = priority === 'high' ? 120000 : 300000;
    if (prefetchCache.current[cacheKey] && (now - prefetchCache.current[cacheKey].timestamp) < maxAge) {
      prefetchStats.current.hits++;
      return prefetchCache.current[cacheKey].promise;
    }

    // Rate limiting - don't prefetch more than once per 100ms
    if (now - lastPrefetchTime.current < 100) {
      return;
    }
    lastPrefetchTime.current = now;

    performanceMonitor.mark(`prefetch-${threadId}-start`);
    
    const prefetchPromise = utils.chat.getMessages.prefetch({ threadId }).then(() => {
      performanceMonitor.mark(`prefetch-${threadId}-end`);
      performanceMonitor.measure(`prefetch-${threadId}`, `prefetch-${threadId}-start`, `prefetch-${threadId}-end`);
      
      prefetchStats.current.totalPrefetches++;
      console.log(`[PREFETCH] Successfully prefetched thread ${threadId} (${priority} priority)`);
    }).catch((error) => {
      prefetchStats.current.misses++;
      console.warn(`[PREFETCH] Failed to prefetch thread ${threadId}:`, error);
    });

    // Cache the promise
    prefetchCache.current[cacheKey] = {
      timestamp: now,
      promise: prefetchPromise,
      priority
    };

    return prefetchPromise;
  }, [enabled, utils.chat.getMessages]);

  // Batch prefetch multiple threads
  const batchPrefetchThreads = useCallback(async (threadIds: string[], priority: 'high' | 'medium' | 'low' = 'low') => {
    if (!enabled || !threadIds.length) return;

    // Process in chunks to avoid overwhelming the network
    const chunks = [];
    for (let i = 0; i < threadIds.length; i += batchSize) {
      chunks.push(threadIds.slice(i, i + batchSize));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(threadId => prefetchThread(threadId, priority));
      await Promise.allSettled(promises);
      
      // Small delay between chunks to prevent network congestion
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }, [enabled, batchSize, prefetchThread]);

  // Prefetch models and other static data
  const prefetchStaticData = useCallback(async () => {
    if (!enabled) return;

    const staticDataPromises = [
      utils.models.getModels.prefetch(),
      utils.models.getFavoriteModels.prefetch(),
      utils.userPreferences.getBestDefaultModel.prefetch(),
      utils.apiKeys.hasAnyApiKeys.prefetch()
    ];

    try {
      await Promise.allSettled(staticDataPromises);
      console.log('[PREFETCH] Static data prefetched successfully');
    } catch (error) {
      console.warn('[PREFETCH] Failed to prefetch static data:', error);
    }
  }, [enabled, utils]);

  // Intersection Observer for visible threads
  const observeVisibleThreads = useCallback((threadElements: NodeListOf<Element> | Element[]) => {
    if (!enabled || !aggressiveMode) return;

    if (intersectionObserver.current) {
      intersectionObserver.current.disconnect();
    }

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        const visibleThreadIds = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => entry.target.getAttribute('data-thread-id'))
          .filter(Boolean) as string[];

        if (visibleThreadIds.length > 0) {
          batchPrefetchThreads(visibleThreadIds, 'low');
        }
      },
      {
        rootMargin: '100px', // Start prefetching 100px before element is visible
        threshold: 0.1
      }
    );

    threadElements.forEach(element => {
      if (intersectionObserver.current) {
        intersectionObserver.current.observe(element);
      }
    });
  }, [enabled, aggressiveMode, batchPrefetchThreads]);

  // Debounced hover handler
  const debouncedHover = useMemo(
    () => debounce((threadId: string) => {
      prefetchThread(threadId, 'medium');
    }, hoverDelay),
    [prefetchThread, hoverDelay]
  );

  // Thread interaction handlers
  const handleThreadHover = useCallback((threadId: string) => {
    if (!enabled) return;
    debouncedHover(threadId);
  }, [enabled, debouncedHover]);

  const handleThreadMouseDown = useCallback((threadId: string) => {
    if (!enabled) return;
    
    // Cancel any pending hover prefetch
    const timeoutKey = `hover-${threadId}`;
    const existingTimeout = prefetchTimeouts.current.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      prefetchTimeouts.current.delete(timeoutKey);
    }

    // Immediate high-priority prefetch on mousedown
    if (mousedownDelay === 0) {
      prefetchThread(threadId, 'high');
    } else {
      const timeout = setTimeout(() => {
        prefetchThread(threadId, 'high');
        prefetchTimeouts.current.delete(`mousedown-${threadId}`);
      }, mousedownDelay);
      
      prefetchTimeouts.current.set(`mousedown-${threadId}`, timeout);
    }
  }, [enabled, mousedownDelay, prefetchThread]);

  // Predictive prefetching based on user patterns
  const predictivelyPrefetch = useCallback((currentThreadId: string, allThreadIds: string[]) => {
    if (!enabled || !aggressiveMode || !currentThreadId) return;

    // Find threads that are likely to be accessed next
    const currentIndex = allThreadIds.indexOf(currentThreadId);
    if (currentIndex === -1) return;

         // Prefetch adjacent threads (most likely to be accessed)
     const adjacentThreads = [
       allThreadIds[currentIndex - 1],
       allThreadIds[currentIndex + 1],
       allThreadIds[currentIndex - 2],
       allThreadIds[currentIndex + 2]
     ].filter((id): id is string => Boolean(id));

    if (adjacentThreads.length > 0) {
      batchPrefetchThreads(adjacentThreads, 'low');
    }
  }, [enabled, aggressiveMode, batchPrefetchThreads]);

  // Get prefetch statistics
  const getPrefetchStats = useCallback(() => {
    const stats = prefetchStats.current;
    const hitRate = stats.totalPrefetches > 0 ? (stats.hits / stats.totalPrefetches) * 100 : 0;
    
    return {
      ...stats,
      hitRate: Math.round(hitRate),
      cacheSize: Object.keys(prefetchCache.current).length
    };
  }, []);

  return {
    // Core prefetching functions
    prefetchThread,
    batchPrefetchThreads,
    prefetchStaticData,
    
    // Interaction handlers
    handleThreadHover,
    handleThreadMouseDown,
    
    // Advanced features
    observeVisibleThreads,
    predictivelyPrefetch,
    
    // Monitoring
    getPrefetchStats,
    
    // Utilities
    clearPrefetchCache: () => {
      prefetchCache.current = {};
      console.log('[PREFETCH] Cache cleared');
    }
  };
}

/**
 * Hook for memoized message blocks to prevent unnecessary re-renders
 */
export function useMessageMemoization() {
  const memoizedBlocks = useRef<Map<string, any>>(new Map());
  
  const getMemoizedBlock = useCallback((blockId: string, content: string, renderer: () => any) => {
    const cacheKey = `${blockId}-${content.length}-${content.slice(0, 50)}`;
    
    if (memoizedBlocks.current.has(cacheKey)) {
      return memoizedBlocks.current.get(cacheKey);
    }
    
    const rendered = renderer();
    memoizedBlocks.current.set(cacheKey, rendered);
    
    // Cleanup old entries to prevent memory leaks
    if (memoizedBlocks.current.size > 1000) {
      const firstKey = memoizedBlocks.current.keys().next().value;
      if (firstKey) {
        memoizedBlocks.current.delete(firstKey);
      }
    }
    
    return rendered;
  }, []);
  
  const clearMemoizedBlocks = useCallback(() => {
    memoizedBlocks.current.clear();
  }, []);
  
  return {
    getMemoizedBlock,
    clearMemoizedBlocks,
  };
}

/**
 * Hook for optimized markdown rendering with block-level memoization
 */
export function useOptimizedMarkdown() {
  const blockCache = useRef<Map<string, string>>(new Map());
  
  const renderMarkdownBlock = useCallback((content: string, blockType: 'text' | 'code' | 'list' | 'header') => {
    const cacheKey = `${blockType}-${content}`;
    
    if (blockCache.current.has(cacheKey)) {
      return blockCache.current.get(cacheKey);
    }
    
    // Simplified markdown rendering - replace with your preferred renderer
    let rendered = content;
    
    switch (blockType) {
      case 'code':
        rendered = `<pre><code>${content}</code></pre>`;
        break;
      case 'header':
        rendered = `<h3>${content}</h3>`;
        break;
      case 'list':
        rendered = `<ul><li>${content}</li></ul>`;
        break;
      default:
        rendered = `<p>${content}</p>`;
    }
    
    blockCache.current.set(cacheKey, rendered);
    return rendered;
  }, []);
  
  return { renderMarkdownBlock };
} 