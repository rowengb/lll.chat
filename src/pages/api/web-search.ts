import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { performWebSearch } from '@/utils/webSearch';
import { debugLog, errorLog, warnLog } from '@/utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user authentication
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { query, numResults = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required and must be a string' });
    }

    debugLog(`🔍 [WEB-SEARCH-API] Performing web search for: "${query}"`);

    // Always perform web search when this endpoint is called
    const searchResults = await performWebSearch(query, numResults);

    if (!searchResults) {
      warnLog(`⚠️ [WEB-SEARCH-API] No search results found for query: "${query}"`);
      return res.status(200).json({ 
        searchResults: [], 
        context: '', 
        rawData: null,
        searchPerformed: true 
      });
    }

    debugLog(`🔍 [WEB-SEARCH-API] Search completed with ${searchResults.searchResults.length} results`);

    return res.status(200).json({
      searchResults: searchResults.searchResults,
      context: searchResults.context,
      rawData: searchResults.rawData,
      searchPerformed: true
    });

  } catch (error) {
    errorLog(`❌ [WEB-SEARCH-API] Search error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error during web search',
      searchResults: [], 
      context: '', 
      rawData: null,
      searchPerformed: false 
    });
  }
} 