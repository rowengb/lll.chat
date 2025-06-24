import { useEffect } from 'react';
import { usePrefetching } from './usePrefetching';

/**
 * 🚀 HYPERSPEED OPTIMIZATION HOOK
 * Enables ALL performance features for maximum speed
 */
export function useHyperspeed() {
  // Enable prefetching system
  const { predictivelyPrefetch } = usePrefetching();

  useEffect(() => {
    // 🔥 REGISTER HYPERSPEED SERVICE WORKER
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw-hyperspeed.js')
        .then((registration) => {
          console.log('🚀 Hyperspeed Service Worker registered:', registration);
          
          // Preload critical routes through service worker
          registration.active?.postMessage({
            type: 'PRELOAD_ROUTES',
            routes: ['/chat/new', '/settings', '/settings?tab=api-keys']
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }

    // ⚡ AGGRESSIVE RESOURCE PRELOADING
    const preloadCriticalResources = () => {
      // Preload fonts for instant text rendering
      const fontPreloads = [
        { href: '/fonts/inter.woff2', type: 'font/woff2' },
        { href: '/fonts/inter-bold.woff2', type: 'font/woff2' }
      ];

      fontPreloads.forEach(({ href, type }) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = 'font';
        link.type = type;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      });

      // Preload critical CSS for instant styling
      const cssPreload = document.createElement('link');
      cssPreload.rel = 'preload';
      cssPreload.href = '/_next/static/css/app.css';
      cssPreload.as = 'style';
      document.head.appendChild(cssPreload);
    };

    // 🎯 CRITICAL RENDERING PATH OPTIMIZATION
    const optimizeCriticalPath = () => {
      // Inline critical CSS for instant rendering
      const criticalCSS = `
        /* CRITICAL STYLES - Inline for instant render */
        .hyperspeed-instant { opacity: 1 !important; transform: none !important; }
        .loading-skeleton { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `;
      
      const style = document.createElement('style');
      style.textContent = criticalCSS;
      document.head.insertBefore(style, document.head.firstChild);
    };

    // 🚀 INSTANT PAINT OPTIMIZATION
    const optimizePaint = () => {
      // Force layer creation for smooth animations
      document.documentElement.style.setProperty('--hyperspeed-enabled', '1');
      
      // Enable GPU acceleration for critical elements
      const criticalSelectors = [
        '.sidebar',
        '.chatbox',
        '.welcome-screen',
        '.settings-page'
      ];

      criticalSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          (el as HTMLElement).style.willChange = 'transform, opacity';
          (el as HTMLElement).style.transform = 'translateZ(0)';
        });
      });
    };

    // 📊 PERFORMANCE MONITORING
    const monitorPerformance = () => {
      // Track critical metrics
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log('🚀 Navigation Performance:', {
              DNS: navEntry.domainLookupEnd - navEntry.domainLookupStart,
              TCP: navEntry.connectEnd - navEntry.connectStart,
              Request: navEntry.responseStart - navEntry.requestStart,
              Response: navEntry.responseEnd - navEntry.responseStart,
              DOM: navEntry.domContentLoadedEventEnd - navEntry.responseEnd,
              Load: navEntry.loadEventEnd - navEntry.loadEventStart,
            });
          }
          
          if (entry.entryType === 'paint') {
            console.log(`🎨 ${entry.name}: ${entry.startTime}ms`);
          }
        });
      });

      // Observe critical metrics
      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
    };

    // 🔧 MEMORY OPTIMIZATION
    const optimizeMemory = () => {
      // Periodic garbage collection hint
      setInterval(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      }, 60000); // Every minute

      // Clean up DOM nodes that are no longer needed
      const cleanupObserver = new MutationObserver(() => {
        // Remove orphaned event listeners
        document.querySelectorAll('[data-cleanup="true"]').forEach(el => {
          el.remove();
        });
      });

      cleanupObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    };

    // 🌐 CONNECTION OPTIMIZATION
    const optimizeConnection = () => {
      // Use faster DNS
      const prefetchDNS = document.createElement('link');
      prefetchDNS.rel = 'dns-prefetch';
      prefetchDNS.href = '//fonts.googleapis.com';
      document.head.appendChild(prefetchDNS);

      // Preconnect to critical origins
      const origins = ['https://api.openai.com', 'https://api.anthropic.com'];
      origins.forEach(origin => {
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = origin;
        document.head.appendChild(preconnect);
      });
    };

    // 🎯 VIEWPORT OPTIMIZATION
    const optimizeViewport = () => {
      // Optimize viewport for instant interaction
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content'
        );
      }

      // Enable smooth scrolling
      document.documentElement.style.scrollBehavior = 'smooth';
    };

    // 🚀 EXECUTE ALL OPTIMIZATIONS
    const runOptimizations = () => {
      preloadCriticalResources();
      optimizeCriticalPath();
      optimizePaint();
      monitorPerformance();
      optimizeMemory();
      optimizeConnection();
      optimizeViewport();
    };

    // Run immediately and after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runOptimizations);
    } else {
      runOptimizations();
    }

    // 🔄 BACKGROUND OPTIMIZATION
    const backgroundOptimize = setInterval(() => {
      // Continuous performance monitoring and optimization
      optimizePaint();
    }, 10000); // Every 10 seconds

    return () => {
      clearInterval(backgroundOptimize);
    };
  }, []);

  return { predictivelyPrefetch };
}

/**
 * 🎯 INSTANT COMPONENT OPTIMIZER
 * Marks components for instant rendering
 */
export function useInstantRender() {
  useEffect(() => {
    // Mark component as instantly rendered
    const markInstant = (element: HTMLElement) => {
      element.classList.add('hyperspeed-instant');
      element.style.willChange = 'auto';
    };

    // Find and mark all instant-render elements
    const instantElements = document.querySelectorAll('[data-instant="true"]');
    instantElements.forEach(el => markInstant(el as HTMLElement));

    // Observer for new instant elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.dataset?.instant === 'true') {
              markInstant(element);
            }
            // Check children too
            element.querySelectorAll?.('[data-instant="true"]').forEach(child => {
              markInstant(child as HTMLElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);
} 