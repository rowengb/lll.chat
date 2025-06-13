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
    <div className="relative my-3">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-gray-600/80 hover:bg-gray-500 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm border border-gray-500/50 hover:border-gray-400"
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
        <div className="absolute top-2 left-3 z-10 px-2 py-1 text-xs text-gray-400 bg-gray-600/80 rounded border border-gray-500/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200">
          {language}
        </div>
      )}
      
      {/* Code content */}
      <pre className="group text-gray-100 p-4 rounded-xl overflow-x-auto text-xs font-mono max-w-full" style={{ backgroundColor: '#0C1117' }}>
        <code className={className}>
          {children}
        </code>
      </pre>
    </div>
  );
} 