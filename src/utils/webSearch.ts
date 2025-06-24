/**
 * Universal Web Search using Exa.AI
 * 
 * This module provides web search functionality that works with ALL AI models,
 * not just Gemini models with built-in grounding. It uses Exa.AI to perform 
 * web searches and formats the results for use with any LLM.
 * 
 * How it works:
 * 1. When search grounding is enabled and the model doesn't have built-in grounding
 * 2. Web search is performed for EVERY message (user controls via toggle)
 * 3. Exa.AI searches for current web results related to the user's message
 * 4. The search results are injected into the conversation context
 * 5. The LLM receives both the user's question and current web information
 * 6. Grounding sources are displayed in the UI for transparency
 * 
 * Supported for: OpenAI, Anthropic, DeepSeek, OpenRouter, and all other models
 * Built-in grounding: Still used for Gemini 2.0+ models when available
 */

import Exa from "exa-js";
import { debugLog, warnLog, errorLog } from './logger';

// Interface for search results
export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  confidence?: number;
  unfurled?: {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    finalUrl?: string;
  };
}

export interface WebSearchMetadata {
  sources?: WebSearchResult[];
  rawData?: any;
}

// Initialize Exa client with API key from environment
const EXA_API_KEY = process.env.EXA_API_KEY || "20038570-77cf-4468-bf74-9903e4c6b65a";

/**
 * Performs a web search using Exa.AI and returns formatted results
 * @param query - The search query
 * @param numResults - Number of results to return (default: 5)
 * @returns Promise with search results and metadata
 */
export async function performWebSearch(
  query: string, 
  numResults: number = 5
): Promise<{ searchResults: WebSearchResult[]; context: string; rawData: any } | null> {
  try {
    debugLog(`🔍 [EXA-SEARCH] Starting web search for query: "${query}"`);
    
    const exa = new Exa(EXA_API_KEY);
    
    // Perform search with content
    const result = await exa.searchAndContents(query, {
      text: true,
      context: true,
      numResults: numResults
    });

    debugLog(`🔍 [EXA-SEARCH] Search completed with ${result.results?.length || 0} results`);

    if (!result.results || result.results.length === 0) {
      warnLog(`⚠️ [EXA-SEARCH] No search results found for query: "${query}"`);
      return null;
    }

    // Format search results
    const searchResults: WebSearchResult[] = result.results.map((item: any, index: number) => ({
      title: item.title || `Result ${index + 1}`,
      url: item.url,
      snippet: item.text ? item.text.substring(0, 300) + (item.text.length > 300 ? '...' : '') : undefined,
      confidence: 95 - (index * 5), // Assign confidence based on ranking
      unfurled: {
        title: item.title,
        description: item.text ? item.text.substring(0, 200) + (item.text.length > 200 ? '...' : '') : undefined,
        finalUrl: item.url,
        siteName: extractDomainName(item.url)
      }
    }));

    // Create context for the LLM
    const context = result.results.map((item: any, index: number) => 
      `[${index + 1}] ${item.title}\nURL: ${item.url}\n${item.text ? item.text.substring(0, 500) + (item.text.length > 500 ? '...' : '') : 'No content available'}\n`
    ).join('\n---\n');

    debugLog(`🔍 [EXA-SEARCH] Formatted ${searchResults.length} results with ${context.length} characters of context`);

    return {
      searchResults,
      context,
      rawData: result
    };

  } catch (error) {
    errorLog(`❌ [EXA-SEARCH] Search error:`, error);
    return null;
  }
}

/**
 * Determines if a user message needs web search
 * @param message - The user message content
 * @returns boolean indicating if search is needed
 * @deprecated Always returns true now - web search is performed when search grounding is enabled
 */
export function shouldPerformWebSearch(message: string): boolean {
  // Always perform web search when called - user controls this via search toggle
  debugLog(`🔍 [EXA-SEARCH] Web search enabled for message: "${message.substring(0, 100)}..."`);
  return true;
}

/**
 * Creates an enhanced prompt with web search context
 * @param originalMessage - The original user message
 * @param searchContext - The context from web search results
 * @returns Enhanced prompt with search context
 */
export function createEnhancedPrompt(originalMessage: string, searchContext: string): string {
  return `You have access to the following current information from web search results:

${searchContext}

Please use this information to provide an accurate and up-to-date response to the following user question. Cite specific sources when referencing the search results.

User Question: ${originalMessage}`;
}

/**
 * Extracts domain name from URL
 * @param url - Full URL
 * @returns Domain name
 */
function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch (error) {
    return url;
  }
} 