import { NextApiRequest, NextApiResponse } from 'next';
import { JSDOM } from 'jsdom';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<UnfurlResult>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ url: '', error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ url: '', error: 'URL is required' });
  }

  try {
    console.log(`🔗 [UNFURL] Unfurling URL: ${url}`);
    
    // Follow redirects and fetch the final page
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LLL.chat/1.0; +https://lll.chat)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const finalUrl = response.url; // This will be the final URL after redirects
    
    console.log(`🔗 [UNFURL] Final URL after redirects: ${finalUrl}`);

    // Parse HTML to extract metadata
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract metadata using various methods
    const result: UnfurlResult = {
      url,
      finalUrl,
    };

    // Title - try multiple sources
    result.title = 
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      document.querySelector('title')?.textContent ||
      document.querySelector('h1')?.textContent ||
      undefined;

    // Description - try multiple sources
    result.description = 
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      undefined;

    // Image - try multiple sources
    const imageUrl = 
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:image:src"]')?.getAttribute('content') ||
      undefined;

    if (imageUrl) {
      // Make relative URLs absolute
      result.image = new URL(imageUrl, finalUrl).href;
    }

    // Site name
    result.siteName = 
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      document.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
      undefined;

    // Favicon
    const faviconUrl = 
      document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
      document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
      document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ||
      '/favicon.ico';

    if (faviconUrl) {
      // Make relative URLs absolute
      result.favicon = new URL(faviconUrl, finalUrl).href;
    }

    // Clean up text content
    if (result.title) {
      result.title = result.title.trim().substring(0, 200);
    }
    if (result.description) {
      result.description = result.description.trim().substring(0, 500);
    }

    console.log(`🔗 [UNFURL] Successfully unfurled: ${result.title || 'No title'}`);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error(`🔗 [UNFURL] Error unfurling URL ${url}:`, error);
    
    return res.status(200).json({
      url,
      finalUrl: undefined,
      error: error instanceof Error ? error.message : 'Failed to unfurl URL',
    });
  }
}
 