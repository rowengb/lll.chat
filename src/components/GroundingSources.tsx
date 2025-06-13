import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, SearchIcon, LoaderIcon } from 'lucide-react';
import { useUnfurlUrl } from '../hooks/useUnfurlUrl';

interface GroundingSource {
  title: string; // Domain name (e.g., "pbs.org", "democracynow.org")
  url: string; // Vertexaisearch redirect URL (e.g., "https://vertexaisearch.cloud.google.com/grounding-api-redirect/...")
  snippet?: string;
  confidence?: number; // Confidence percentage (0-100)
  // Unfurled metadata from the actual destination
  unfurled?: {
    title?: string; // Actual article title
    description?: string; // Article description
    image?: string; // Article image
    favicon?: string; // Site favicon
    siteName?: string; // Site name
    finalUrl?: string; // Final URL after redirects
  };
}

interface GroundingMetadata {
  searchQueries?: string[]; // The search queries used
  groundedSegments?: Array<{
    text: string;
    confidence: number;
  }>; // Grounded text segments with confidence
  sources?: GroundingSource[]; // The sources used for grounding
  rawData?: any; // Raw grounding data from Google
}

interface GroundingSourcesProps {
  sources?: GroundingSource[];
  searchQueries?: string[];
  groundedSegments?: Array<{
    text: string;
    confidence: number;
  }>;
  rawData?: any; // Add raw data prop
  messageId?: string; // Add messageId for database persistence
}

// Individual source card component with unfurling
function SourceCard({ 
  source, 
  index, 
  messageId 
}: { 
  source: GroundingSource; 
  index: number; 
  messageId?: string;
}) {
  const { data: unfurlData, loading: unfurlLoading } = useUnfurlUrl(
    source.url, 
    messageId, 
    index,
    source.unfurled
  );

  return (
    <div key={index} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-3">
        {/* Favicon */}
        {unfurlData?.favicon && !unfurlData.error && (
          <img 
            src={unfurlData.favicon} 
            alt="" 
            className="w-4 h-4 mt-1 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        
        <div className="flex-1 min-w-0">
          {/* Article title (unfurled) or domain name */}
          {source.url ? (
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline block mb-1"
            >
              {unfurlData?.title || source.title}
              {unfurlLoading && <LoaderIcon className="inline w-3 h-3 ml-1 animate-spin" />}
            </a>
          ) : (
            <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              {unfurlData?.title || source.title}
              {unfurlLoading && <LoaderIcon className="inline w-3 h-3 ml-1 animate-spin" />}
            </div>
          )}
          
          {/* Site name and domain */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {unfurlData?.siteName && unfurlData.siteName !== source.title && (
              <span>{unfurlData.siteName} • </span>
            )}
            <span>{source.title}</span>
            {unfurlData?.finalUrl && (
              <span className="ml-1">
                <ExternalLinkIcon className="inline w-3 h-3" />
              </span>
            )}
          </div>
          
          {/* Article description (unfurled) or snippet */}
          {(unfurlData?.description || source.snippet) && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-3">
              {unfurlData?.description || source.snippet}
            </p>
          )}
          
          {/* Confidence badge */}
          {source.confidence !== undefined && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {source.confidence}% confidence
              </span>
            </div>
          )}
        </div>
        
        {/* Article image */}
        {unfurlData?.image && !unfurlData.error && (
          <img 
            src={unfurlData.image} 
            alt="Article preview" 
            className="w-16 h-16 object-cover rounded flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>
    </div>
  );
}

export function GroundingSources({ 
  sources = [], 
  searchQueries = [], 
  groundedSegments = [],
  rawData,
  messageId
}: GroundingSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  if (!sources.length && !searchQueries.length && !groundedSegments.length && !rawData) {
    return null;
  }

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <span className="flex items-center gap-2">
          <SearchIcon className="w-4 h-4" />
          View grounding sources
        </span>
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4" />
        ) : (
          <ChevronRightIcon className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 max-w-full overflow-hidden">
          {/* Raw Data Dump Section */}
          <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-between text-sm font-medium text-red-700 dark:text-red-300"
            >
              <span>🔍 RAW GROUNDING DATA DUMP</span>
              {showRawData ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
            
            {showRawData && (
              <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs overflow-auto max-h-96">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Search Queries Section */}
          {searchQueries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <SearchIcon className="w-4 h-4" />
                Search Queries
              </h4>
              <div className="space-y-1">
                {searchQueries.map((query, index) => (
                  <div key={index} className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm text-blue-800 dark:text-blue-200 break-words">
                    "{query}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grounded Segments Section */}
          {groundedSegments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                <span className="text-xs">%</span>
                Grounded Segments
              </h4>
              <div className="space-y-2">
                {groundedSegments.map((segment, index) => (
                  <div key={index} className="px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-md text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        {segment.confidence}% confidence
                      </span>
                    </div>
                    <div className="text-green-800 dark:text-green-200 break-words">
                      "{segment.text}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources Section */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Sources ({sources.length})
              </h4>
              <div className="space-y-3">
                {sources.map((source, index) => (
                  <SourceCard 
                    key={index}
                    source={source} 
                    index={index} 
                    messageId={messageId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 