// Minimal service worker to prevent 404 errors
// This is a placeholder service worker that does nothing

self.addEventListener('install', function(event) {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Don't intercept any requests - just let them pass through
  return;
}); 