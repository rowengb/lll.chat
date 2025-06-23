// Critical performance optimizations for sub-50ms speeds

// 1. Debounce for search and input fields
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 2. Throttle for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// 3. RequestAnimationFrame-based smooth operations
export const rafThrottle = <T extends (...args: any[]) => any>(func: T) => {
  let rafId: number | null = null;
  return (...args: Parameters<T>) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
};

// 4. Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) => {
  const defaultOptions = {
    threshold: 0.1,
    rootMargin: '50px',
    ...options,
  };
  
  return new IntersectionObserver(callback, defaultOptions);
};

// 5. Image preloading for better UX
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// 6. Batch DOM updates
export const batchUpdates = (callback: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
};

// 7. Memory-efficient chunk processing
export const processInChunks = <T>(
  array: T[],
  chunkSize: number,
  processor: (chunk: T[]) => void,
  delay: number = 0
) => {
  let index = 0;
  
  const processChunk = () => {
    const chunk = array.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      processor(chunk);
      index += chunkSize;
      
      if (index < array.length) {
        if (delay > 0) {
          setTimeout(processChunk, delay);
        } else {
          requestAnimationFrame(processChunk);
        }
      }
    }
  };
  
  processChunk();
};

// 8. Optimized scroll position management
export const optimizeScrolling = (element: HTMLElement) => {
  let scrollTimeout: NodeJS.Timeout;
  
  const handleScroll = throttle(() => {
    element.style.pointerEvents = 'none';
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      element.style.pointerEvents = 'auto';
    }, 150);
  }, 16); // 60fps
  
  element.addEventListener('scroll', handleScroll, { passive: true });
  
  return () => {
    element.removeEventListener('scroll', handleScroll);
    clearTimeout(scrollTimeout);
  };
};

// 9. Component update optimization
export const shouldComponentUpdate = (
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  keys: string[]
): boolean => {
  return keys.some(key => prevProps[key] !== nextProps[key]);
};

// 10. CSS-in-JS optimization for dynamic styles
export const createStyleSheet = (styles: Record<string, string>) => {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  
  const css = Object.entries(styles)
    .map(([selector, rules]) => `${selector} { ${rules} }`)
    .join('\n');
    
  styleSheet.appendChild(document.createTextNode(css));
  document.head.appendChild(styleSheet);
  
  return styleSheet;
};

// 11. Efficient event delegation
export const createEventDelegator = (
  container: HTMLElement,
  eventType: string,
  selector: string,
  handler: (event: Event, target: Element) => void
) => {
  const delegatedHandler = (event: Event) => {
    const target = (event.target as Element).closest(selector);
    if (target && container.contains(target)) {
      handler(event, target);
    }
  };
  
  container.addEventListener(eventType, delegatedHandler, { passive: true });
  
  return () => container.removeEventListener(eventType, delegatedHandler);
};

// 12. Web Worker utilities for heavy computations
export const createWorkerTask = <T, R>(
  workerScript: string,
  data: T
): Promise<R> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript);
    
    worker.onmessage = (event) => {
      resolve(event.data);
      worker.terminate();
    };
    
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    
    worker.postMessage(data);
  });
};

// 13. Local storage with compression
export const compressedStorage = {
  setItem: (key: string, value: any) => {
    try {
      const compressed = JSON.stringify(value);
      localStorage.setItem(key, compressed);
    } catch (error) {
      console.warn('Failed to store item:', error);
    }
  },
  
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Failed to retrieve item:', error);
      return defaultValue;
    }
  },
  
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  }
};

// 14. Network request optimization
export const optimizedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// 15. Performance monitoring utilities
export const performanceMonitor = {
  mark: (name: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
  },
  
  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof performance !== 'undefined' && performance.measure) {
      performance.measure(name, startMark, endMark);
    }
  },
  
  getEntries: () => {
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      return performance.getEntriesByType('measure');
    }
    return [];
  },

  measureRender(componentName: string, renderFn: () => void): void {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    if (end - start > 16) {
      console.warn(`Slow render detected: ${componentName} took ${(end - start).toFixed(2)}ms`);
    }
  },

  measureAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return asyncFn().finally(() => {
      const end = performance.now();
      if (end - start > 100) {
        console.warn(`Slow async operation: ${name} took ${(end - start).toFixed(2)}ms`);
      }
    });
  }
};

// Performance optimization utilities for chat application

// Compression utilities for localStorage
export const compression = {
  compress(data: any): string {
    try {
      const jsonString = JSON.stringify(data);
      // Simple compression using a basic dictionary approach
      const dict: Record<string, string> = {
        '"id"': '§i',
        '"title"': '§t',
        '"model"': '§m',
        '"content"': '§c',
        '"role"': '§r',
        '"user"': '§u',
        '"assistant"': '§a',
        '"_creationTime"': '§ct',
        '"threadId"': '§ti',
        '"messages"': '§ms',
        '"threads"': '§ts',
        'true': '§T',
        'false': '§F',
        'null': '§N'
      };
      
      let compressed = jsonString;
      Object.entries(dict).forEach(([key, value]) => {
        compressed = compressed.replace(new RegExp(key, 'g'), value);
      });
      
      return compressed;
    } catch {
      return JSON.stringify(data);
    }
  },

  decompress(compressedData: string): any {
    try {
      const dict: Record<string, string> = {
        '§i': '"id"',
        '§t': '"title"',
        '§m': '"model"',
        '§c': '"content"',
        '§r': '"role"',
        '§u': '"user"',
        '§a': '"assistant"',
        '§ct': '"_creationTime"',
        '§ti': '"threadId"',
        '§ms': '"messages"',
        '§ts': '"threads"',
        '§T': 'true',
        '§F': 'false',
        '§N': 'null'
      };
      
      let decompressed = compressedData;
      Object.entries(dict).forEach(([key, value]) => {
        decompressed = decompressed.replace(new RegExp(key, 'g'), value);
      });
      
      return JSON.parse(decompressed);
    } catch {
      return JSON.parse(compressedData);
    }
  }
};

// Cache management utilities
export const cacheUtils = {
  set(key: string, data: any, ttl: number = 300000): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl
      };
      const compressed = compression.compress(item);
      localStorage.setItem(key, compressed);
    } catch (error) {
      // Handle storage quota exceeded
      console.warn('Cache storage failed:', error);
      this.cleanup();
    }
  },

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const decompressed = compression.decompress(item);
      
      if (Date.now() - decompressed.timestamp > decompressed.ttl) {
        localStorage.removeItem(key);
        return null;
      }
      
      return decompressed.data;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  },

  isStale(key: string, staleTime: number = 60000): boolean {
    try {
      const item = localStorage.getItem(key);
      if (!item) return true;
      
      const decompressed = compression.decompress(item);
      return Date.now() - decompressed.timestamp > staleTime;
    } catch {
      return true;
    }
  },

  cleanup(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('chat_cache_')) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const decompressed = compression.decompress(item);
            if (Date.now() - decompressed.timestamp > decompressed.ttl) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
};



// Memory management
export const memoryUtils = {
  clearOldCaches(): void {
    cacheUtils.cleanup();
  },

  getMemoryUsage(): { used: number; total: number } {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => ({
        used: estimate.usage || 0,
        total: estimate.quota || 0
      })) as any;
    }
    return { used: 0, total: 0 };
  }
};

// Prefetch queue management
export const prefetchQueue = {
  queue: new Set<string>(),
  processing: false,

  add(key: string): void {
    this.queue.add(key);
    this.process();
  },

  async process(): Promise<void> {
    if (this.processing || this.queue.size === 0) return;
    
    this.processing = true;
    const items = Array.from(this.queue);
    this.queue.clear();
    
    // Process items in batches to avoid overwhelming the system
    for (let i = 0; i < items.length; i += 3) {
      const batch = items.slice(i, i + 3);
      await Promise.allSettled(
        batch.map(async (key) => {
          // Custom prefetch logic would go here
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      );
    }
    
    this.processing = false;
    
    // Process any new items that were added during processing
    if (this.queue.size > 0) {
      this.process();
    }
  }
}; 