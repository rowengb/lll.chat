import "@/styles/globals.css";
import { type AppType } from "next/app";
import { trpc } from "@/utils/trpc";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";
import { ConvexClientProvider } from "@/lib/convex";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";

// Wrapper component that can access the theme
function ClerkWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? dark : undefined
      }}
    >
      {children}
    </ClerkProvider>
  );
}

const MyApp: AppType = ({
  Component,
  pageProps,
}) => {
  const router = useRouter();
  
  // Create a key that only changes for different page types, not different chat threads
  const getPageKey = () => {
    if (router.pathname === "/settings") return "settings";
    if (router.pathname === "/chat/[threadId]" || router.pathname === "/") return "chat";
    return router.pathname;
  };

  return (
    <ThemeProvider>
      <ClerkWrapper>
        <div className="h-full min-h-screen bg-background text-foreground">
          <ConvexClientProvider>
            <Component {...pageProps} />
            <Toaster
              position="bottom-right"
              reverseOrder={false}
              gutter={0}
              containerStyle={{
                bottom: 20,
                right: 20,
              }}
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '13px',
                  borderRadius: '6px',
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