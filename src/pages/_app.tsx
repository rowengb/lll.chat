import "@/styles/globals.css";
import { type AppType } from "next/app";
import { trpc } from "@/utils/trpc";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import { Toaster } from "react-hot-toast";
import { ConvexClientProvider } from "@/lib/convex";
import { ClerkProvider } from "@clerk/nextjs";

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
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <div className="h-full min-h-screen bg-gray-50">
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
                background: '#ffffff',
                color: '#09090b',
                fontSize: '13px',
                borderRadius: '6px',
                padding: '8px 12px',
                border: '1px solid #e4e4e7',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                fontWeight: '500',
                minHeight: 'auto',
                maxWidth: '300px',
              },
              success: {
                iconTheme: {
                  primary: '#09090b',
                  secondary: '#ffffff',
                },
                style: {
                  background: '#ffffff',
                  color: '#09090b',
                  border: '1px solid #d4d4d8',
                },
              },
              error: {
                iconTheme: {
                  primary: '#09090b',
                  secondary: '#ffffff',
                },
                style: {
                  background: '#ffffff',
                  color: '#09090b',
                  border: '1px solid #d4d4d8',
                },
              },
            }}
          />
        </ConvexClientProvider>
      </div>
    </ClerkProvider>
  );
};

export default trpc.withTRPC(MyApp); 