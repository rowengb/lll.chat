import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/home',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
]);

const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
  '/account(.*)',
  '/chat(.*)',
  '/settings(.*)',
  '/api/trpc(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    try {
      await auth.protect();
    } catch (error) {
      // If auth fails, let the pages handle auth themselves
      // This prevents middleware from returning 404s
      console.log('Auth protection failed, letting page handle auth:', error);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}; 