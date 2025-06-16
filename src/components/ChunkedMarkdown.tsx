import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';

interface ChunkedMarkdownProps {
  content: string;
  className?: string;
  chunkSize?: number; // Number of lines per chunk
}

interface MarkdownChunk {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  isStreaming?: boolean;
}

// Cache for rendered chunks
const chunkCache = new Map<string, React.ReactElement>();

// Generate a hash for cache key
const generateHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

// Preprocess content to extract markdown from code blocks when appropriate
const preprocessMarkdownContent = (content: string): string => {
  // Check if the entire content is wrapped in a single markdown code block
  const lines = content.trim().split('\n');
  
  // Pattern 1: Complete ```markdown ... ``` (entire content wrapped and complete)
  if (lines.length >= 3 && 
      lines[0]?.trim().match(/^```\s*markdown\s*$/i) && 
      lines[lines.length - 1]?.trim() === '```') {
    // Extract content between the code block markers
    const extractedContent = lines.slice(1, -1).join('\n');
    console.log('[MARKDOWN] Extracted content from complete markdown code block');
    return extractedContent;
  }
  
  // Pattern 2: Streaming ```markdown ... (incomplete, still streaming)
  if (lines.length >= 2 && 
      lines[0]?.trim().match(/^```\s*markdown\s*$/i) && 
      !lines[lines.length - 1]?.trim().startsWith('```')) {
    // Extract content after the opening marker, but keep it as-is since it's still streaming
    const extractedContent = lines.slice(1).join('\n');
    console.log('[MARKDOWN] Processing streaming markdown code block');
    return extractedContent;
  }
  
  // Pattern 3: Complete ``` ... ``` (generic code block that might contain markdown)
  if (lines.length >= 3 && 
      lines[0]?.trim() === '```' && 
      lines[lines.length - 1]?.trim() === '```') {
    const extractedContent = lines.slice(1, -1).join('\n');
    
    // Check if the extracted content looks like markdown (has markdown syntax)
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^__|\[.*\]\(.*\)|^\s*[-*+]\s|^\s*\d+\.\s|^\|.*\|/m.test(extractedContent);
    
    if (hasMarkdownSyntax) {
      console.log('[MARKDOWN] Extracted markdown-like content from complete generic code block');
      return extractedContent;
    }
  }
  
  // Pattern 4: Streaming ``` ... (incomplete generic code block)
  if (lines.length >= 2 && 
      lines[0]?.trim() === '```' && 
      !lines[lines.length - 1]?.trim().startsWith('```')) {
    const extractedContent = lines.slice(1).join('\n');
    
    // Check if the extracted content looks like markdown (has markdown syntax)
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^__|\[.*\]\(.*\)|^\s*[-*+]\s|^\s*\d+\.\s|^\|.*\|/m.test(extractedContent);
    
    if (hasMarkdownSyntax) {
      console.log('[MARKDOWN] Processing streaming generic code block with markdown content');
      return extractedContent;
    }
  }
  
  // Pattern 5: Mixed content with markdown code blocks - extract and render inline
  let processedContent = content;
  
  // Find complete markdown code blocks and extract their content
  const markdownBlockRegex = /```\s*markdown\s*\n([\s\S]*?)\n```/gi;
  processedContent = processedContent.replace(markdownBlockRegex, (match, markdownContent) => {
    console.log('[MARKDOWN] Extracted inline markdown code block');
    return markdownContent;
  });
  
  return processedContent;
};

// Split markdown content into logical chunks
const chunkMarkdown = (content: string, chunkSize: number = 100): MarkdownChunk[] => {
  const lines = content.split('\n');
  const chunks: MarkdownChunk[] = [];
  
  let currentChunk: string[] = [];
  let chunkStartLine = 0;
  let inCodeBlock = false;
  let codeBlockFence = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    
    currentChunk.push(line);
    
    // Track code block boundaries to avoid splitting them
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockFence = line.trim();
      } else {
        // End of code block
        inCodeBlock = false;
        codeBlockFence = '';
      }
    }
    
    // Create chunk when we reach chunk size and we're not in a code block
    if (currentChunk.length >= chunkSize && !inCodeBlock) {
      // Look for a good breaking point (empty line, heading, or list item)
      let breakPoint = -1;
      for (let j = currentChunk.length - 1; j >= Math.max(0, currentChunk.length - 20); j--) {
        const checkLine = currentChunk[j] || '';
        
        const trimmedLine = checkLine.trim();
        if (trimmedLine === '' || 
            trimmedLine.startsWith('#') || 
            trimmedLine.startsWith('- ') || 
            trimmedLine.startsWith('* ') || 
            trimmedLine.match(/^\d+\. /)) {
          breakPoint = j;
          break;
        }
      }
      
      // If no good break point found, don't chunk yet
      if (breakPoint === -1) {
        continue;
      }
      
      // Create chunk up to break point
      const chunkContent = currentChunk.slice(0, breakPoint + 1).filter(Boolean).join('\n');
      if (chunkContent.trim()) {
        chunks.push({
          id: generateHash(chunkContent + chunkStartLine.toString()),
          content: chunkContent,
          startLine: chunkStartLine,
          endLine: chunkStartLine + breakPoint
        });
      }
      
      // Start new chunk with remaining lines
      currentChunk = currentChunk.slice(breakPoint + 1);
      chunkStartLine = i - currentChunk.length + 1;
    }
  }
  
  // Add remaining content as final chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.filter(Boolean).join('\n');
    if (chunkContent.trim()) {
      chunks.push({
        id: generateHash(chunkContent + chunkStartLine.toString()),
        content: chunkContent,
        startLine: chunkStartLine,
        endLine: lines.length - 1
      });
    }
  }
  
  return chunks;
};

// Memoized chunk renderer
const MemoizedChunk = React.memo(({ chunk, isStreaming }: { chunk: MarkdownChunk; isStreaming?: boolean }) => {
  return useMemo(() => {
    const cacheKey = chunk.id;
    
    // Skip cache for streaming content to prevent stale chunks
    if (!isStreaming) {
      // Check cache first for non-streaming content
      if (chunkCache.has(cacheKey)) {
        return chunkCache.get(cacheKey)!;
      }
    }
    
    // Render chunk
    const rendered = (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Style headers with proper sizing
          h1: ({ node, ...props }) => (
            <h1 
              className="text-2xl font-bold text-foreground mt-6 mb-4 first:mt-0"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2 
              className="text-xl font-semibold text-foreground mt-5 mb-3 first:mt-0"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3 
              className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4 
              className="text-base font-semibold text-foreground mt-3 mb-2 first:mt-0"
              {...props}
            />
          ),
          h5: ({ node, ...props }) => (
            <h5 
              className="text-sm font-semibold text-foreground mt-3 mb-2 first:mt-0"
              {...props}
            />
          ),
          h6: ({ node, ...props }) => (
            <h6 
              className="text-xs font-semibold text-foreground mt-3 mb-2 first:mt-0"
              {...props}
            />
          ),
          // Style paragraphs
          p: ({ node, ...props }) => (
            <p 
              className="text-sm text-foreground mb-3 last:mb-0 leading-relaxed"
              {...props}
            />
          ),
          // Customize link styling
          a: ({ node, ...props }) => (
            <a 
              {...props} 
              className="text-primary hover:text-primary/80 underline"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          // Customize code block styling
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            return isInline ? (
              <code 
                className="text-foreground px-2 py-1 rounded text-xs font-mono bg-gray-100 dark:bg-muted border border-gray-300 dark:border-border" 
                {...props}
              >
                {children}
              </code>
            ) : null; // Block code will be handled by pre
          },
          // Style pre blocks with copy functionality
          pre: ({ node, children, ...props }) => {
            // Extract language from the code element
            const codeElement = children as any;
            const className = codeElement?.props?.className || '';
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : undefined;
            
            // If no language detected, it might be a plain pre block
            if (!language && !className) {
              return (
                <pre 
                  className="text-foreground p-4 rounded-xl overflow-x-auto dark-scrollbar text-xs font-mono w-full min-w-0 my-3 bg-gray-100 dark:bg-muted border border-gray-300 dark:border-border whitespace-pre" 
                  {...props}
                >
                  {children}
                </pre>
              );
            }
            
            return (
              <CodeBlock 
                className={className}
                language={language}
              >
                {codeElement?.props?.children || children}
              </CodeBlock>
            );
          },
          // Style lists
          ul: ({ node, ...props }) => (
            <ul 
              className="list-disc list-outside space-y-1 my-3 ml-4 pl-2"
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol 
              className="list-decimal list-outside space-y-1 my-3 ml-4 pl-2"
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li 
              className="text-sm text-foreground leading-relaxed"
              {...props}
            />
          ),
          // Style blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground"
              {...props}
            />
          ),
          // Style horizontal rules
          hr: ({ node, ...props }) => (
            <hr 
              className="border-border my-6"
              {...props}
            />
          ),
          // Style tables
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table 
                className="min-w-full border-collapse border border-border"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead 
              className="bg-muted"
              {...props}
            />
          ),
          th: ({ node, ...props }) => (
            <th 
              className="border border-border px-3 py-2 text-left font-semibold text-foreground text-sm leading-relaxed"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td 
              className="border border-border px-3 py-2 text-sm text-foreground leading-relaxed"
              {...props}
            />
          ),
          // Style strong and emphasis
          strong: ({ node, ...props }) => (
            <strong 
              className="font-semibold text-foreground"
              {...props}
            />
          ),
          em: ({ node, ...props }) => (
            <em 
              className="italic text-foreground"
              {...props}
            />
          ),
        }}
      >
        {chunk.content}
      </ReactMarkdown>
    );
    
    // Only cache non-streaming content
    if (!isStreaming) {
      chunkCache.set(cacheKey, rendered);
      
      // Limit cache size to prevent memory leaks
      if (chunkCache.size > 100) {
        const firstKey = chunkCache.keys().next().value;
        if (firstKey) {
          chunkCache.delete(firstKey);
        }
      }
    }
    
    return rendered;
  }, [chunk.id, chunk.content, isStreaming]);
});

MemoizedChunk.displayName = 'MemoizedChunk';

export const ChunkedMarkdown: React.FC<ChunkedMarkdownProps> = ({ 
  content, 
  className = "w-full min-w-0 overflow-hidden",
  chunkSize = 100 
}) => {
  const chunks = useMemo(() => {
    // Preprocess content to extract markdown from code blocks
    const processedContent = preprocessMarkdownContent(content);
    
    // Detect if content appears to be streaming (incomplete code blocks)
    const lines = content.trim().split('\n');
    const isStreaming = (
      (lines[0]?.trim().match(/^```\s*markdown\s*$/i) && !lines[lines.length - 1]?.trim().startsWith('```')) ||
      (lines[0]?.trim() === '```' && !lines[lines.length - 1]?.trim().startsWith('```'))
    );
    
    if (isStreaming) {
      // Clear cache for streaming content to prevent stale chunks
      chunkCache.clear();
    }
    
    // For small content, don't chunk
    if (processedContent.split('\n').length <= chunkSize * 2) {
      return [{
        id: generateHash(processedContent + (isStreaming ? Date.now().toString() : '')),
        content: processedContent,
        startLine: 0,
        endLine: processedContent.split('\n').length - 1,
        isStreaming
      }];
    }
    
    const chunkedContent = chunkMarkdown(processedContent, chunkSize);
    return chunkedContent.map(chunk => ({ ...chunk, isStreaming }));
  }, [content, chunkSize]);
  
  return (
    <div className={className}>
      {chunks.map((chunk) => (
        <MemoizedChunk key={chunk.id} chunk={chunk} isStreaming={chunk.isStreaming} />
      ))}
    </div>
  );
};

// Utility to clear cache when needed
export const clearMarkdownCache = () => {
  chunkCache.clear();
}; 