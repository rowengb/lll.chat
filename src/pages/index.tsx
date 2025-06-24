import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { LoadingDots } from '@/components/LoadingDots';

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Immediate redirect to unified chat route
    router.replace('/chat/new');
  }, [router]);

  // Show minimal loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingDots text="Loading" size="lg" />
    </div>
  );
} 