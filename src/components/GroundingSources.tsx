import React, { useState, useRef, useEffect } from 'react';
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
  sources?: GroundingSource[]; // The sources used for grounding
}

interface GroundingSourcesProps {
  sources?: GroundingSource[];
  messageId?: string; // Add messageId for database persistence
  onToggle?: (isExpanded: boolean, elementRef: HTMLDivElement | null) => void; // Callback when toggle state changes
}

// Individual source list item component with unfurling
function SourceListItem({ 
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

  // Use unfurled data if available, otherwise fall back to source data
  const displayTitle = unfurlData?.title || source.title;
  const displaySiteName = unfurlData?.siteName || source.unfurled?.siteName;
  const displayFavicon = unfurlData?.favicon || source.unfurled?.favicon;

  return (
    <li className="flex items-start gap-2">
      {/* Bullet point */}
      <span className="text-gray-400 dark:text-gray-500 mt-1 text-xs">•</span>
      
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Favicon */}
        {displayFavicon ? (
          <img 
            src={displayFavicon} 
            alt="" 
            className="w-4 h-4 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <ExternalLinkIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        )}

        {/* Title and site name */}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
        >
          {displayTitle}
          {displaySiteName && displaySiteName !== displayTitle && (
            <span className="text-gray-500 dark:text-gray-400 ml-1">
              — {displaySiteName}
            </span>
          )}
        </a>

        {/* Loading indicator */}
        {unfurlLoading && (
          <LoaderIcon className="w-3 h-3 animate-spin text-gray-400 flex-shrink-0" />
        )}
      </div>
    </li>
  );
}

export function GroundingSources({ 
  sources = [], 
  messageId,
  onToggle
}: GroundingSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    // Call the callback with the new state and element reference
    if (onToggle) {
      // Use setTimeout to ensure the DOM has updated before calling the callback
      setTimeout(() => {
        onToggle(newExpanded, containerRef.current);
      }, 0);
    }
  };

  if (!sources.length) {
    return null;
  }

  return (
    <div className="mt-3" ref={containerRef}>
      <button
        onClick={handleToggle}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors"
      >
        View grounding sources ({sources.length})
      </button>

      {/* Always render the list items to trigger prefetching, but hide when collapsed */}
      <div className={`mt-3 ${isExpanded ? 'block' : 'hidden'}`}>
        <ul className="space-y-2">
          {sources.map((source, index) => (
            <SourceListItem 
              key={index}
              source={source} 
              index={index} 
              messageId={messageId}
            />
          ))}
        </ul>
      </div>
    </div>
  );
} 