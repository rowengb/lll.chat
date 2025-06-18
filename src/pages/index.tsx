import { type NextPage } from "next";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useEffect } from "react";

const Home: NextPage = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
    if (user) {
        // User is authenticated, redirect to app
        router.replace('/app');
      } else {
        // User is not authenticated, redirect to home page
        router.replace('/home');
      }
    }
  }, [isLoaded, user, router]);

  // Show minimal loading while redirecting
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