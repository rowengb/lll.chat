import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, SearchIcon, LoaderIcon } from 'lucide-react';
import { trpc } from '../utils/trpc';

interface GroundingSource {
  title: string; // Domain name (e.g., "pbs.org", "democracynow.org")
  url: string; // Vertexaisearch redirect URL (e.g., "https://vertexaisearch.cloud.google.com/grounding-api-redirect/...")
  snippet?: string;
  confidence?: number; // Confidence percentage (0-100)
  // Database fields (from saved unfurled data)
  unfurledTitle?: string;
  unfurledDescription?: string;
  unfurledImage?: string;
  unfurledFavicon?: string;
  unfurledSiteName?: string;
  unfurledFinalUrl?: string;
  unfurledAuthor?: string;
  unfurledPublishedDate?: string;
  unfurledAt?: number;
  // Real-time unfurled metadata from Exa.AI
  unfurled?: {
    title?: string; // Actual article title
    description?: string; // Article description
    image?: string; // Article image
    favicon?: string; // Site favicon
    siteName?: string; // Site name
    finalUrl?: string; // Final URL after redirects
    author?: string; // Article author
    publishedDate?: string; // Article publish date
  };
}

interface GroundingMetadata {
  sources?: GroundingSource[]; // The sources used for grounding
}

interface GroundingSourcesProps {
  sources?: GroundingSource[];
  messageId?: string; // Add messageId for database persistence
  onToggle?: (isExpanded: boolean, elementRef: HTMLDivElement | null) => void; // Callback when toggle state changes
  rawData?: any; // Raw metadata to determine search provider
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
  // Unfurling disabled - use basic source data only
  const unfurlLoading = false;

  // Use rich data - prioritize real-time Exa.AI data, fallback to saved database data
  const displayTitle = source.unfurled?.title || source.unfurledTitle || source.title;
  const displaySiteName = source.unfurled?.siteName || source.unfurledSiteName;
  const displayFavicon = source.unfurled?.favicon || source.unfurledFavicon;
  const displayAuthor = source.unfurled?.author || source.unfurledAuthor;
  const displayPublishedDate = source.unfurled?.publishedDate || source.unfurledPublishedDate;
  const displayImage = source.unfurled?.image || source.unfurledImage;

  return (
    <li className="flex items-start gap-2">
      {/* Bullet point */}
      <span className="text-gray-400 dark:text-gray-500 mt-1 text-xs">•</span>
      
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Article image with favicon overlay or standalone favicon */}
        <div className="flex-shrink-0">
          {displayImage ? (
            <div className="relative">
              <img 
                src={displayImage} 
                alt={displayTitle}
                className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  // Fallback to favicon if image fails
                  const img = e.target as HTMLImageElement;
                  if (displayFavicon) {
                    img.src = displayFavicon;
                    img.className = "w-6 h-6 flex-shrink-0 mt-0.5 rounded";
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />
              {/* Favicon overlay on bottom-right corner of article image */}
              {displayFavicon && (
                <img 
                  src={displayFavicon} 
                  alt="" 
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-sm border border-white dark:border-gray-800 bg-white dark:bg-gray-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
          ) : displayFavicon ? (
            <img 
              src={displayFavicon} 
              alt="" 
              className="w-6 h-6 flex-shrink-0 mt-0.5 rounded border border-gray-200 dark:border-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <ExternalLinkIcon className="w-6 h-6 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
          )}
        </div>

        {/* Title, author, and metadata */}
        <div className="flex flex-col min-w-0 flex-1">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors truncate leading-snug"
          >
            {displayTitle}
            {displaySiteName && displaySiteName !== displayTitle && (
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                — {displaySiteName}
              </span>
            )}
          </a>
          
          {/* Author and date metadata */}
          {(displayAuthor || displayPublishedDate) && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
              {displayAuthor && (
                <span>by {displayAuthor}</span>
              )}
              {displayAuthor && displayPublishedDate && (
                <span className="mx-1">•</span>
              )}
              {displayPublishedDate && (
                <span>{new Date(displayPublishedDate).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {unfurlLoading && (
          <LoaderIcon className="w-3 h-3 animate-spin text-gray-400 flex-shrink-0" />
        )}
      </div>
    </li>
  );
}

// Exa logo SVG component
const ExaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg 
    height="20" 
    viewBox="0 0 278 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M161.632 53.2837H115.472C115.918 66.4186 125.061 72.7596 133.981 72.7596C142.9 72.7596 147.806 68.6833 150.371 62.682H160.851C158.064 73.2126 148.587 81.8182 133.981 81.8182C115.026 81.8182 104.545 68.0039 104.545 50C104.545 30.7506 117.256 18.4083 133.646 18.4083C151.931 18.4083 162.97 34.0343 161.632 53.2837ZM133.646 27.2404C124.615 27.2404 116.476 32.2226 115.584 44.4516H150.928C150.705 35.846 144.35 27.2404 133.646 27.2404Z" fill="currentColor"></path>
    <path d="M219.201 19.4274L198.797 48.528L221.208 80.3462H209.055L192.777 57.1336L176.61 80.3462H165.014L187.09 48.9809L166.352 19.4274H178.505L193.111 40.3753L207.829 19.4274H219.201Z" fill="currentColor"></path>
    <path d="M266.458 54.869V51.0191C248.061 52.944 236.354 55.6616 236.354 64.0408C236.354 69.8156 240.702 73.6655 247.949 73.6655C257.426 73.6655 266.458 69.2494 266.458 54.869ZM245.719 81.8182C234.458 81.8182 225.092 75.4772 225.092 64.2672C225.092 49.8868 241.036 45.6972 265.677 42.8664V41.3944C265.677 30.2976 259.545 26.561 252.075 26.561C243.712 26.561 238.806 31.2035 238.36 38.6768H227.88C228.883 25.5419 240.256 18.1818 251.963 18.1818C268.465 18.1818 275.935 26.2213 275.823 43.3193L275.712 57.3601C275.6 67.551 276.158 74.5713 277.273 80.3462H267.015C266.681 78.0815 266.346 75.5904 266.235 71.967C262.555 78.1948 256.311 81.8182 245.719 81.8182Z" fill="currentColor"></path>
    <path fillRule="evenodd" clipRule="evenodd" d="M0 0H78.1818V7.46269L44.8165 50L78.1818 92.5373V100H0V0ZM39.5825 43.1172L66.6956 7.46269H12.4695L39.5825 43.1172ZM8.79612 16.3977V46.2687H31.5111L8.79612 16.3977ZM31.5111 53.7313H8.79612V83.6023L31.5111 53.7313ZM12.4695 92.5373L39.5825 56.8828L66.6956 92.5373H12.4695Z" fill="#1F40ED"></path>
  </svg>
);

export function GroundingSources({ 
  sources = [], 
  messageId,
  onToggle,
  rawData
}: GroundingSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Rich metadata is now saved directly to database during streaming process
  // No secondary unfurling needed since Exa.AI data is captured and saved immediately

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

  // Determine if this is from Exa.AI web search or Gemini built-in grounding
  const isExaSearch = rawData?.searchProvider === 'exa';

  return (
    <div className="mt-3" ref={containerRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
        >
          View grounding sources ({sources.length})
        </button>
        
        {/* Attribution tag */}
        {isExaSearch ? (
          <div className="flex items-center gap-1.5 px-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full h-6">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Powered by
            </span>
            <ExaLogo className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full h-6">
            <SearchIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Google Search
            </span>
          </div>
        )}
      </div>

      {/* Always render to trigger unfurling immediately, hide visually when collapsed */}
      <div className={`mt-3 transition-all duration-200 ${isExpanded ? 'block' : 'invisible h-0 overflow-hidden'}`}>
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