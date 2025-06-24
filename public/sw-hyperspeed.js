// 🚀 HYPERSPEED SERVICE WORKER - Caches EVERYTHING for instant loading
const CACHE_VERSION = 'v1';
const CACHE_NAME = `lll-chat-hyperspeed-${CACHE_VERSION}`;

// 🔥 CRITICAL RESOURCES - Cache with highest priority
const CRITICAL_RESOURCES = [
  '/',
  '/chat/new',
  '/settings',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/favicon.ico',
  '/manifest.json'
];

// ⚡ API RESPONSES - Cache for instant data access
const API_CACHE_NAME = `api-cache-${CACHE_VERSION}`;
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 🎯 INSTANT RESPONSE PATTERNS
const INSTANT_PATTERNS = [
  /\/_next\/static\//,
  /\/api\/trpc/,
  /\.(js|css|woff2|png|jpg|svg|ico)$/
];

// 🚀 INSTALL - Preload critical resources immediately
self.addEventListener('install', (event) => {
  console.log('🚀 Hyperspeed Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Preload critical resources in parallel for maximum speed
      const criticalPromises = CRITICAL_RESOURCES.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.log(`⚠️ Failed to cache ${url}:`, error);
        }
      });
      
      await Promise.allSettled(criticalPromises);
      
      // Force activate immediately - no waiting!
      self.skipWaiting();
    })()
  );
});

// ⚡ ACTIVATE - Take control immediately
self.addEventListener('activate', (event) => {
  console.log('⚡ Hyperspeed Service Worker activated!');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches instantly
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames
        .filter(name => name !== CACHE_NAME && name !== API_CACHE_NAME)
        .map(name => caches.delete(name));
      
      await Promise.all(deletePromises);
      
      // Take control of all clients immediately
      await clients.claim();
    })()
  );
});

// 🔥 FETCH - INSTANT response strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 🚀 INSTANT STATIC RESOURCES - Cache first for speed
  if (INSTANT_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      (async () => {
        // Try cache first for instant response
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          // Update cache in background for next time
          event.waitUntil(updateCache(event.request));
          return cachedResponse;
        }
        
        // Not in cache, fetch and cache
        return fetchAndCache(event.request);
      })()
    );
    return;
  }
  
  // 🎯 API REQUESTS - Smart caching with freshness
  if (url.pathname.startsWith('/api/trpc')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        
        // Check if cached response is fresh
        if (cachedResponse) {
          const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0);
          const isExpired = Date.now() - cachedDate.getTime() > API_CACHE_DURATION;
          
          if (!isExpired) {
            // Fresh cache hit - instant response!
            return cachedResponse;
          }
        }
        
        // Fetch fresh data
        try {
          const response = await fetch(event.request);
          
          if (response.ok) {
            // Clone and add cache timestamp
            const responseToCache = response.clone();
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cached-date', new Date().toISOString());
            
            const cachedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers
            });
            
            // Cache in background
            event.waitUntil(cache.put(event.request, cachedResponse));
          }
          
          return response;
        } catch (error) {
          // Network failed, return stale cache if available
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        }
      })()
    );
    return;
  }
  
  // 🏃‍♂️ NAVIGATION - Network first with fast fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for fresh content
          const response = await fetch(event.request);
          
          if (response.ok) {
            // Cache successful navigations
            const cache = await caches.open(CACHE_NAME);
            event.waitUntil(cache.put(event.request, response.clone()));
          }
          
          return response;
        } catch (error) {
          // Network failed, try cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Fallback to offline page or error
          throw error;
        }
      })()
    );
    return;
  }
});

// 🔧 HELPER FUNCTIONS
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Don't await - cache in background for speed
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (error) {
    // Silent fail for background updates
    console.log('Background cache update failed:', error);
  }
}

// 🎯 PRELOAD CRITICAL ROUTES - Load before user needs them
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRELOAD_ROUTES') {
    event.waitUntil(
      (async () => {
        const routes = event.data.routes || [];
        const cache = await caches.open(CACHE_NAME);
        
        const preloadPromises = routes.map(async (route) => {
          try {
            const response = await fetch(route);
            if (response.ok) {
              await cache.put(route, response);
            }
          } catch (error) {
            console.log(`Failed to preload ${route}:`, error);
          }
        });
        
        await Promise.allSettled(preloadPromises);
      })()
    );
  }
});

console.log('🔥 Hyperspeed Service Worker loaded and ready for MAXIMUM SPEED!'); 