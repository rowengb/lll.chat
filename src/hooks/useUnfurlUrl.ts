import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';

interface UnfurlResult {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  url: string; // Original input URL
  finalUrl?: string; // Final URL after redirects
  error?: string;
}

interface UseUnfurlUrlResult {
  data?: UnfurlResult;
  loading: boolean;
  error?: string;
}

// Simple in-memory cache to avoid re-unfurling the same URLs
const unfurlCache = new Map<string, UnfurlResult>();

export function useUnfurlUrl(
  url?: string, 
  messageId?: string, 
  sourceIndex?: number,
  existingUnfurled?: {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    finalUrl?: string;
  }
): UseUnfurlUrlResult {
  const [data, setData] = useState<UnfurlResult | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const updateUnfurlMutation = trpc.chat.updateGroundingSourceUnfurl.useMutation();

  useEffect(() => {
    if (!url) {
      setData(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }

    // If we have existing unfurled data from the database, use it
    if (existingUnfurled && (existingUnfurled.title || existingUnfurled.description || existingUnfurled.image)) {
      const existingResult: UnfurlResult = {
        url,
        title: existingUnfurled.title,
        description: existingUnfurled.description,
        image: existingUnfurled.image,
        favicon: existingUnfurled.favicon,
        siteName: existingUnfurled.siteName,
        finalUrl: existingUnfurled.finalUrl,
      };
      setData(existingResult);
      setLoading(false);
      setError(undefined);
      // Also cache it in memory
      unfurlCache.set(url, existingResult);
      return;
    }

    // Check cache first
    const cached = unfurlCache.get(url);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(cached.error);
      return;
    }

    // Start unfurling
    setLoading(true);
    setError(undefined);

    const unfurlUrl = async () => {
      try {
        const response = await fetch('/api/unfurl-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: UnfurlResult = await response.json();
        
        // Cache the result
        unfurlCache.set(url, result);
        
        setData(result);
        setError(result.error);

        // Save to database if we have messageId and sourceIndex and the unfurl was successful
        if (messageId && sourceIndex !== undefined && !result.error && result.title) {
          console.log(`💾 [UNFURL] Saving to database - messageId: ${messageId}, sourceIndex: ${sourceIndex}, title: ${result.title}`);
          try {
            const saveResult = await updateUnfurlMutation.mutateAsync({
              messageId,
              sourceIndex,
              unfurledData: {
                title: result.title,
                description: result.description,
                image: result.image,
                favicon: result.favicon,
                siteName: result.siteName,
                finalUrl: result.finalUrl,
              },
            });
            console.log(`✅ [UNFURL] Successfully saved to database:`, saveResult);
          } catch (dbError) {
            console.error('❌ [UNFURL] Failed to save unfurl data to database:', dbError);
            // Don't fail the unfurl if database save fails
          }
        } else {
          console.log(`⏭️ [UNFURL] Skipping database save - messageId: ${messageId}, sourceIndex: ${sourceIndex}, error: ${result.error}, title: ${result.title}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to unfurl URL';
        const errorResult: UnfurlResult = { url, error: errorMessage };
        
        // Cache the error result too
        unfurlCache.set(url, errorResult);
        
        setData(errorResult);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    unfurlUrl();
  }, [url, messageId, sourceIndex, existingUnfurled, updateUnfurlMutation]);

  return { data, loading, error };
}

// Utility function to clear the cache if needed
export function clearUnfurlCache() {
  unfurlCache.clear();
} 