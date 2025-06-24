import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { trpc } from '@/utils/trpc';

/**
 * HYPERSPEED PREFETCHING SYSTEM
 * Predicts user behavior and preloads everything they might need
 */
export function usePrefetching() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const prefetchTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // 🚀 INSTANT ROUTE PREFETCHING - Preload likely destinations
    const prefetchRoutes = () => {
      // Prefetch settings page when user is in chat (they often switch)
      if (router.pathname.includes('/chat')) {
        router.prefetch('/settings');
        router.prefetch('/settings?tab=api-keys');
        router.prefetch('/settings?tab=account');
      }
      
      // Prefetch chat when user is in settings (they often go back)
      if (router.pathname.includes('/settings')) {
        router.prefetch('/chat/new');
      }
      
      // Prefetch sign-in/up from home page
      if (router.pathname === '/home') {
        router.prefetch('/sign-in');
        router.prefetch('/sign-up');
      }
    };

    // 🔥 AGGRESSIVE DATA PREFETCHING - Load data before it's needed
    const prefetchData = () => {
      // Always keep user preferences fresh
      utils.userPreferences.getPreferences.prefetch();
      utils.userPreferences.getBestDefaultModel.prefetch();
      
      // Prefetch threads list (for sidebar)
      utils.chat.getThreads.prefetch();
      
      // Prefetch models (for dropdowns)
      utils.models.getModels.prefetch();
      utils.models.getFavoriteModels.prefetch();
      
      // Prefetch API keys (for settings)
      utils.apiKeys.getApiKeys.prefetch();
      utils.apiKeys.hasAnyApiKeys.prefetch();
    };

    // 🎯 HOVER PREFETCHING - Load on hover (300ms before click)
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button[data-prefetch]');
      
      if (link) {
        const href = link.getAttribute('href') || link.getAttribute('data-prefetch');
        if (href && !prefetchTimeouts.current.has(href)) {
          // Prefetch after 100ms hover (faster than click reaction time)
          const timeout = setTimeout(() => {
            router.prefetch(href);
            prefetchTimeouts.current.delete(href);
          }, 100);
          
          prefetchTimeouts.current.set(href, timeout);
        }
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button[data-prefetch]');
      
      if (link) {
        const href = link.getAttribute('href') || link.getAttribute('data-prefetch');
        if (href && prefetchTimeouts.current.has(href)) {
          clearTimeout(prefetchTimeouts.current.get(href)!);
          prefetchTimeouts.current.delete(href);
        }
      }
    };

    // 📱 TOUCH PREFETCHING - Prefetch on touchstart (faster than touchend)
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button[data-prefetch]');
      
      if (link) {
        const href = link.getAttribute('href') || link.getAttribute('data-prefetch');
        if (href) {
          router.prefetch(href);
        }
      }
    };

    // Initialize prefetching
    prefetchRoutes();
    prefetchData();

    // Add event listeners for hover/touch prefetching
    document.addEventListener('mouseenter', handleMouseEnter, { capture: true, passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { capture: true, passive: true });
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });

    // 🔄 CONTINUOUS BACKGROUND PREFETCHING
    const backgroundPrefetch = setInterval(() => {
      prefetchData();
    }, 30000); // Every 30 seconds

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, { capture: true });
      document.removeEventListener('mouseleave', handleMouseLeave, { capture: true });
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      clearInterval(backgroundPrefetch);
      
      // Clean up pending timeouts
      prefetchTimeouts.current.forEach(timeout => clearTimeout(timeout));
      prefetchTimeouts.current.clear();
    };
  }, [router, utils]);

  // 🎯 PREDICTIVE PREFETCHING API
  const predictivelyPrefetch = (route: string, delay = 0) => {
    setTimeout(() => {
      router.prefetch(route);
    }, delay);
  };

  return { predictivelyPrefetch };
}

/**
 * MEMORY POOL - Reuse objects to reduce garbage collection
 */
class MemoryPool {
  private pools = new Map<string, any[]>();

  get<T>(type: string, factory: () => T): T {
    if (!this.pools.has(type)) {
      this.pools.set(type, []);
    }
    
    const pool = this.pools.get(type)!;
    return pool.length > 0 ? pool.pop() : factory();
  }

  release<T>(type: string, object: T) {
    if (!this.pools.has(type)) {
      this.pools.set(type, []);
    }
    
    const pool = this.pools.get(type)!;
    if (pool.length < 50) { // Limit pool size
      pool.push(object);
    }
  }
}

export const memoryPool = new MemoryPool(); 