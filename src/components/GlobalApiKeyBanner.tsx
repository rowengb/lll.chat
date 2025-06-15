import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import { trpc } from '@/utils/trpc';
import { ApiKeyWarningBanner } from './ApiKeyWarningBanner';

export function GlobalApiKeyBanner() {
  const { user } = useUser();
  const router = useRouter();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // API Key warning banner state
  const { data: hasAnyApiKeys } = trpc.apiKeys.hasAnyApiKeys.useQuery(
    undefined,
    { enabled: !!user } // Only run when user is logged in
  );

  // Show banner if user has no API keys and hasn't dismissed it
  const shouldShowBanner = user && hasAnyApiKeys === false && !bannerDismissed;

  const navigateToSettings = () => {
    router.push('/?view=settings&tab=api-keys', undefined, { shallow: true });
  };

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <ApiKeyWarningBanner
      onNavigateToSettings={navigateToSettings}
      onDismiss={() => setBannerDismissed(true)}
      isDismissible={true}
    />
  );
} 