import "@/styles/globals.css";
import { type AppType } from "next/app";
import { trpc } from "@/utils/trpc";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";
import { ConvexClientProvider } from "@/lib/convex";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { useEffect, useState, Suspense } from "react";
import Head from "next/head";
import dynamic from 'next/dynamic';
import { LoadingDots } from '@/components/LoadingDots';
import { performanceMonitor } from '@/utils/performanceOptimizations';

// Intelligent code splitting with preloading  
const ChatWindow = dynamic(() => import('@/components/ChatWindow').then(mod => ({ default: mod.ChatWindow })), {
  loading: () => <LoadingDots text="Loading chat" size="lg" />,
  ssr: false
});

const ModelSelector = dynamic(() => import('@/components/ModelSelector').then(mod => ({ default: mod.ModelSelector })), {
  loading: () => <div className="h-10 bg-muted animate-pulse rounded-lg" />,
  ssr: false
});

const Sidebar = dynamic(() => import('@/components/Sidebar').then(mod => ({ default: mod.Sidebar })), {
  loading: () => <div className="w-72 bg-muted animate-pulse" />,
  ssr: false
});

const SettingsPage = dynamic(() => import('@/pages/settings'), {
  loading: () => <LoadingDots text="Loading settings" size="lg" />,
  ssr: false
});

// Preload critical components based on route
const preloadComponents = {
  '/': [ChatWindow, Sidebar],
  '/app': [ChatWindow, Sidebar, ModelSelector],
  '/chat/[threadId]': [ChatWindow, Sidebar, ModelSelector],
  '/settings': [SettingsPage, ModelSelector],
  '/home': [] // Landing page doesn't need heavy components
};

// Wrapper component that can access the theme
function ClerkWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      signInForceRedirectUrl="/app"
      signUpForceRedirectUrl="/app"
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? dark : undefined
      }}
    >
      {children}
    </ClerkProvider>
  );
}

// Performance monitoring wrapper
function PerformanceWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [navigationStart, setNavigationStart] = useState<number>(0);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      const start = performance.now();
      setNavigationStart(start);
      performanceMonitor.mark(`navigation-${url}-start`);
      console.log(`[NAVIGATION] Starting navigation to ${url}`);
    };

    const handleRouteChangeComplete = (url: string) => {
      const end = performance.now();
      const duration = end - navigationStart;
      
      performanceMonitor.mark(`navigation-${url}-end`);
      performanceMonitor.measure(`navigation-${url}`, `navigation-${url}-start`, `navigation-${url}-end`);
      
      console.log(`[NAVIGATION] Completed navigation to ${url} in ${duration.toFixed(2)}ms`);
      
      // Warn about slow navigations
      if (duration > 1000) {
        console.warn(`[NAVIGATION] Slow navigation detected: ${url} took ${duration.toFixed(2)}ms`);
      }
    };

    const handleRouteChangeError = (err: any, url: string) => {
      console.error(`[NAVIGATION] Navigation error to ${url}:`, err);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router, navigationStart]);

  // Preload components based on current route
  useEffect(() => {
    const componentsToPreload = preloadComponents[router.pathname as keyof typeof preloadComponents] || [];
    
    // Preload components with a small delay to not block initial render
    const preloadTimer = setTimeout(() => {
      componentsToPreload.forEach((Component) => {
        if (typeof Component === 'function' && 'preload' in Component) {
          // Trigger dynamic import
          (Component as any).preload?.();
        }
      });
    }, 100);

    return () => clearTimeout(preloadTimer);
  }, [router.pathname]);

  // Prefetch likely next routes based on current route
  useEffect(() => {
    const prefetchRoutes = () => {
      switch (router.pathname) {
        case '/':
        case '/home':
          // From landing, likely to go to app
          router.prefetch('/app');
          break;
        case '/app':
          // From app, likely to go to settings or specific chat
          router.prefetch('/settings');
          break;
        case '/chat/[threadId]':
          // From chat, likely to go back to app or settings
          router.prefetch('/app');
          router.prefetch('/settings');
          break;
        case '/settings':
          // From settings, likely to go back to app
          router.prefetch('/app');
          break;
      }
    };

    // Prefetch with a delay to not interfere with current page load
    const prefetchTimer = setTimeout(prefetchRoutes, 500);
    return () => clearTimeout(prefetchTimer);
  }, [router]);

  return <>{children}</>;
}

// Optimized loading fallback
function AppLoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <LoadingDots text="Loading app" size="lg" />
    </div>
  );
}

const MyApp: AppType = ({
  Component,
  pageProps,
}) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Track mount time for performance monitoring
  useEffect(() => {
    const mountStart = performance.now();
    setMounted(true);
    
    const mountEnd = performance.now();
    console.log(`[APP] App mounted in ${(mountEnd - mountStart).toFixed(2)}ms`);
  }, []);

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return <AppLoadingFallback />;
  }
  
  // Create a key that only changes for different page types, not different chat threads
  const getPageKey = () => {
    if (router.pathname === "/settings") return "settings";
    if (router.pathname === "/chat/[threadId]" || router.pathname === "/") return "chat";
    if (router.pathname === "/home") return "home";
    return router.pathname;
  };

  return (
    <ThemeProvider>
      <ClerkWrapper>
        <Head>
          {/* Preload critical resources */}
          <link rel="preload" href="/api/trpc/chat.getThreads" as="fetch" crossOrigin="anonymous" />
          <link rel="preload" href="/api/trpc/models.getModels" as="fetch" crossOrigin="anonymous" />
          
          {/* Standard favicons */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          
          {/* Performance hints */}
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta httpEquiv="x-dns-prefetch-control" content="on" />
          <link rel="dns-prefetch" href="//api.openai.com" />
          <link rel="dns-prefetch" href="//api.anthropic.com" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
        </Head>
        
        <div className="h-full min-h-screen-mobile bg-background text-foreground">
          <ConvexClientProvider>
            <PerformanceWrapper>
              <Suspense fallback={<AppLoadingFallback />}>
            <Component {...pageProps} />
              </Suspense>
            </PerformanceWrapper>
            
            {/* Optimized toast notifications */}
            <Toaster
              position="top-right"
              reverseOrder={false}
              gutter={0}
              containerStyle={{
                top: 20,
                right: 20,
              }}
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '13px',
                  borderRadius: '20px',
                  padding: '8px 12px',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  fontWeight: '500',
                  minHeight: 'auto',
                  maxWidth: '300px',
                },
                success: {
                  iconTheme: {
                    primary: 'hsl(var(--foreground))',
                    secondary: 'hsl(var(--background))',
                  },
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                },
                error: {
                  iconTheme: {
                    primary: 'hsl(var(--foreground))',
                    secondary: 'hsl(var(--background))',
                  },
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                },
              }}
            />
          </ConvexClientProvider>
        </div>
      </ClerkWrapper>
    </ThemeProvider>
  );
};

export default trpc.withTRPC(MyApp); 