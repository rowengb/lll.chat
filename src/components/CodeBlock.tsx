import { useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  language?: string;
}

export function CodeBlock({ children, className, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Extract text content from React children
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return String(node || '');
      };
      
      const codeText = extractText(children);
      
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      toast.success('Code copied to clipboard');
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  return (
    <div className="relative my-3 w-full min-w-0">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm border border-border hover:border-border/80"
        title="Copy code"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </button>
      
      {/* Language label */}
      {language && (
        <div className="absolute top-2 left-3 z-10 px-2 py-1 text-xs text-muted-foreground bg-background/80 rounded border border-border backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200">
          {language}
        </div>
      )}
      
      {/* Code content */}
      <pre className="group text-foreground p-4 rounded-xl overflow-x-auto dark-scrollbar text-xs font-mono w-full min-w-0 bg-gray-100 dark:bg-muted border border-gray-300 dark:border-border whitespace-pre">
        <code className={`${className} block whitespace-pre`}>
          {children}
        </code>
      </pre>
    </div>
  );
} 