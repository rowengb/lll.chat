import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useEffect } from "react";

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  // Handle redirects based on authentication state
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        if (user) {
          router.replace('/app');
        } else {
          router.replace('/home');
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, user, router]);

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60"></div>
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60 animation-delay-100"></div>
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60 animation-delay-200"></div>
        </div>
        <span className="text-base text-foreground/80 animate-pulse">Loading...</span>
      </div>
    </div>
  );
};

export default Home; 