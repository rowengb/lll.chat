import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';
import { performanceMonitor } from '@/utils/performanceOptimizations';

interface MessageProps {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  isStreaming?: boolean;
  model?: string;
  isGrounded?: boolean;
  groundingMetadata?: any;
  imageUrl?: string;
  attachments?: any[];
  stoppedByUser?: boolean;
  isError?: boolean;
}

interface MessageBlockProps {
  content: string;
  type: 'text' | 'code' | 'list' | 'header' | 'table' | 'quote';
  index: number;
  isStreaming?: boolean;
  cacheKey: string;
}

// Global cache for rendered blocks - persists across component unmounts
const blockCache = new Map<string, React.ReactElement>();
const renderTimes = new Map<string, number>();

// Cache cleanup - runs every 5 minutes
let lastCleanup = Date.now();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;
const MAX_CACHE_AGE = 10 * 60 * 1000; // 10 minutes

const cleanupCache = () => {
  const now = Date.now();
  if (now - lastCleanup < CACHE_CLEANUP_INTERVAL) return;
  
  // Remove old entries
  for (const [key, timestamp] of renderTimes.entries()) {
    if (now - timestamp > MAX_CACHE_AGE) {
      blockCache.delete(key);
      renderTimes.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (blockCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(renderTimes.entries())
      .sort(([,a], [,b]) => a - b)
      .slice(0, blockCache.size - MAX_CACHE_SIZE);
    
    sortedEntries.forEach(([key]) => {
      blockCache.delete(key);
      renderTimes.delete(key);
    });
  }
  
  lastCleanup = now;
  console.log(`[CACHE] Cleaned up, cache size: ${blockCache.size}`);
};

// Detect block type for optimized rendering
const detectBlockType = (content: string): MessageBlockProps['type'] => {
  const trimmed = content.trim();
  
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) return 'code';
  if (trimmed.startsWith('#')) return 'header';
  if (trimmed.startsWith('|') && trimmed.includes('|')) return 'table';
  if (trimmed.startsWith('>')) return 'quote';
  if (/^[\s]*[-*+]\s/.test(trimmed) || /^[\s]*\d+\.\s/.test(trimmed)) return 'list';
  
  return 'text';
};

// Split content into logical blocks for memoization
const splitIntoBlocks = (content: string): Array<{ content: string; type: MessageBlockProps['type'] }> => {
  if (!content?.trim()) return [{ content: '', type: 'text' }];
  
  const lines = content.split('\n');
  const blocks: Array<{ content: string; type: MessageBlockProps['type'] }> = [];
  
  let currentBlock: string[] = [];
  let currentType: MessageBlockProps['type'] = 'text';
  let inCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    
    // Handle code blocks specially
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        currentBlock.push(line);
        blocks.push({
          content: currentBlock.join('\n'),
          type: 'code'
        });
        currentBlock = [];
        currentType = 'text';
        inCodeBlock = false;
      } else {
        // Start of code block - finish current block if any
        if (currentBlock.length > 0) {
          blocks.push({
            content: currentBlock.join('\n'),
            type: currentType
          });
        }
        currentBlock = [line];
        currentType = 'code';
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }
    
    const lineType = detectBlockType(line);
    
    // If type changed, start new block
    if (lineType !== currentType && currentBlock.length > 0) {
      blocks.push({
        content: currentBlock.join('\n'),
        type: currentType
      });
      currentBlock = [line];
      currentType = lineType;
    } else {
      currentBlock.push(line);
      if (currentBlock.length === 1) {
        currentType = lineType;
      }
    }
  }
  
  // Add final block
  if (currentBlock.length > 0) {
    blocks.push({
      content: currentBlock.join('\n'),
      type: currentType
    });
  }
  
  return blocks.length > 0 ? blocks : [{ content: content, type: 'text' }];
};

// Ultra-fast block renderer with aggressive memoization
const MessageBlock = memo<MessageBlockProps>(({ content, type, index, isStreaming, cacheKey }) => {
  const renderStartTime = useRef<number>(0);
  
  const renderedContent = useMemo(() => {
    renderStartTime.current = performance.now();
    performanceMonitor.mark(`block-${cacheKey}-start`);
    
    // Skip cache for streaming content to prevent stale renders
    if (!isStreaming && blockCache.has(cacheKey)) {
      const cached = blockCache.get(cacheKey)!;
      performanceMonitor.mark(`block-${cacheKey}-end`);
      performanceMonitor.measure(`block-${cacheKey}`, `block-${cacheKey}-start`, `block-${cacheKey}-end`);
      return cached;
    }
    
    let result: React.ReactElement;
    
    // Optimized rendering based on block type
    switch (type) {
      case 'code':
        result = (
          <pre className="bg-muted/50 p-3 rounded-md overflow-x-auto border border-border/50 my-2">
            <code className="text-sm font-mono leading-relaxed">
              {content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')}
            </code>
          </pre>
        );
        break;
        
      case 'header':
        const level = Math.min((content.match(/^#+/) || [''])[0].length, 6);
        const headerText = content.replace(/^#+\s*/, '');
        const headerClass = [
          'text-2xl font-bold mt-6 mb-4',
          'text-xl font-bold mt-5 mb-3', 
          'text-lg font-semibold mt-4 mb-3',
          'text-base font-semibold mt-3 mb-2',
          'text-sm font-semibold mt-3 mb-2',
          'text-xs font-semibold mt-2 mb-1'
        ][level - 1] || 'text-sm font-semibold mt-2 mb-1';
        
                 const HeaderTag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
         result = React.createElement(
           HeaderTag,
           { className: `${headerClass} text-foreground first:mt-0` },
           headerText
         );
        break;
        
      case 'list':
        const isOrdered = /^\s*\d+\./.test(content);
        const listItems = content.split('\n').map((line, i) => {
          const cleanLine = line.replace(/^[\s]*[-*+]\s|^[\s]*\d+\.\s/, '').trim();
          return cleanLine ? (
            <li key={i} className="mb-1 leading-relaxed">
              {cleanLine}
            </li>
          ) : null;
        }).filter(Boolean);
        
        result = React.createElement(
          isOrdered ? 'ol' : 'ul',
          { className: `${isOrdered ? 'list-decimal' : 'list-disc'} list-inside space-y-1 my-3 pl-4` },
          ...listItems
        );
        break;
        
      case 'table':
        const rows = content.split('\n').filter(line => line.trim().startsWith('|'));
        const tableRows = rows.map((row, i) => {
          const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
          return (
            <tr key={i} className={i === 0 ? 'border-b border-border font-medium' : ''}>
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-sm border-r border-border last:border-r-0">
                  {cell}
                </td>
              ))}
            </tr>
          );
        });
        
        result = (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border border-border rounded-md">
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        );
        break;
        
      case 'quote':
        const quoteText = content.split('\n').map(line => line.replace(/^>\s?/, '')).join('\n');
        result = (
          <blockquote className="border-l-4 border-primary/30 pl-4 py-2 my-3 bg-muted/20 rounded-r-md">
            <p className="text-sm italic text-foreground/80 leading-relaxed">{quoteText}</p>
          </blockquote>
        );
        break;
        
      default: // text
        result = (
          <p className="text-sm text-foreground leading-relaxed my-2 last:mb-0 first:mt-0 whitespace-pre-wrap">
            {content}
          </p>
        );
    }
    
    // Cache non-streaming content
    if (!isStreaming) {
      blockCache.set(cacheKey, result);
      renderTimes.set(cacheKey, Date.now());
      
      // Periodic cache cleanup
      cleanupCache();
    }
    
    const renderTime = performance.now() - renderStartTime.current;
    performanceMonitor.mark(`block-${cacheKey}-end`);
    performanceMonitor.measure(`block-${cacheKey}`, `block-${cacheKey}-start`, `block-${cacheKey}-end`);
    
    // Warn about slow renders
    if (renderTime > 16) {
      console.warn(`[RENDER] Slow block render: ${type} took ${renderTime.toFixed(2)}ms (target: <16ms)`);
    }
    
    return result;
  }, [content, type, isStreaming, cacheKey]);
  
  return renderedContent;
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.cacheKey === nextProps.cacheKey &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.content === nextProps.content
  );
});

MessageBlock.displayName = 'MessageBlock';

// Main memoized message component
export const MemoizedMessage = memo<MessageProps>(({
  id,
  content,
  role,
  timestamp,
  isStreaming = false,
  model,
  isGrounded,
  groundingMetadata,
  imageUrl,
  attachments,
  stoppedByUser,
  isError
}) => {
  const renderStartTime = useRef<number>(0);
  
  const messageBlocks = useMemo(() => {
    renderStartTime.current = performance.now();
    performanceMonitor.mark(`message-${id}-split-start`);
    
    const blocks = splitIntoBlocks(content);
    
    performanceMonitor.mark(`message-${id}-split-end`);
    performanceMonitor.measure(`message-${id}-split`, `message-${id}-split-start`, `message-${id}-split-end`);
    
    return blocks.map((block, index) => ({
      ...block,
      cacheKey: `${id}-${index}-${block.type}-${block.content.length}-${isStreaming ? 'stream' : 'static'}`
    }));
  }, [content, id, isStreaming]);
  
  const handleCopyMessage = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      console.log('Message copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy message:', err);
    });
  }, [content]);
  
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    if (renderTime > 50) {
      console.warn(`[RENDER] Slow message render: ${id} took ${renderTime.toFixed(2)}ms (target: <50ms)`);
    }
  });
  
  return (
    <div 
      className={`message-container ${role} ${isError ? 'error' : ''}`}
      data-message-id={id}
      data-role={role}
      data-model={model}
      data-streaming={isStreaming}
    >
      {/* Message metadata for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground mb-1 opacity-50">
          {role} • {model} • {messageBlocks.length} blocks • {isStreaming ? 'streaming' : 'static'}
        </div>
      )}
      
      {/* Render message blocks */}
      <div className="message-content">
        {messageBlocks.map((block, index) => (
          <MessageBlock
            key={block.cacheKey}
            content={block.content}
            type={block.type}
            index={index}
            isStreaming={isStreaming}
            cacheKey={block.cacheKey}
          />
        ))}
      </div>
      
      {/* Message metadata */}
      {isGrounded && groundingMetadata?.sources && (
        <div className="mt-2 text-xs text-muted-foreground">
          🔍 Grounded ({groundingMetadata.sources.length} sources)
        </div>
      )}
      
      {stoppedByUser && (
        <div className="mt-2 text-xs text-muted-foreground">
          ⏹️ Stopped by user
        </div>
      )}
      
      {/* Image if present */}
      {imageUrl && (
        <div className="mt-3">
          <img 
            src={imageUrl} 
            alt="Generated image" 
            className="max-w-sm rounded-lg border border-border"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
      
      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          📎 {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
        </div>
      )}
      
      {/* Copy button for development */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={handleCopyMessage}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Copy content
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Aggressive comparison for minimal re-renders
  const contentChanged = prevProps.content !== nextProps.content;
  const streamingChanged = prevProps.isStreaming !== nextProps.isStreaming;
  const errorChanged = prevProps.isError !== nextProps.isError;
  const imageChanged = prevProps.imageUrl !== nextProps.imageUrl;
  
  // Only re-render if critical props changed
  return !(contentChanged || streamingChanged || errorChanged || imageChanged);
});

MemoizedMessage.displayName = 'MemoizedMessage';

// Export cache utilities for debugging
export const MessageCacheUtils = {
  getCacheSize: () => blockCache.size,
  getCacheKeys: () => Array.from(blockCache.keys()),
  clearCache: () => {
    blockCache.clear();
    renderTimes.clear();
    console.log('[CACHE] Message cache cleared');
  },
  getCacheStats: () => ({
    size: blockCache.size,
    maxSize: MAX_CACHE_SIZE,
    oldestEntry: Math.min(...Array.from(renderTimes.values())),
    newestEntry: Math.max(...Array.from(renderTimes.values()))
  })
}; 