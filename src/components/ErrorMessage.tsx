import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  rawErrorData?: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, rawErrorData }) => {
  const [showRawData, setShowRawData] = useState(false);

  return (
    <div className="w-full max-w-full overflow-hidden flex items-start gap-3  rounded-lg p-4">
      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-3">
        <div className="text-sm leading-relaxed text-red-800 dark:text-red-200">
          <strong className="text-red-900 dark:text-red-400">Error:</strong> {message}
        </div>
        
        {rawErrorData && (
          <div className="w-full">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-red-100/60 dark:bg-red-900/50 hover:bg-red-200/60 dark:hover:bg-red-800/70 transition-colors text-red-800 dark:text-red-200 rounded-lg"
            >
              <div className="flex items-center gap-2">
                {showRawData ? (
                  <ChevronDown className="h-4 w-4 text-red-700 dark:text-red-300" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-red-700 dark:text-red-300" />
                )}
                <Search className="h-4 w-4 text-red-700 dark:text-red-300" />
                <span className="font-medium">View Raw API Response</span>
              </div>
            </button>
            
            {showRawData && (
              <div className="mt-2 max-h-64 overflow-auto bg-red-50/30 dark:bg-red-950/70 p-3 rounded-lg">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-red-800 dark:text-red-200" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
                  <code className="block w-full">{JSON.stringify(rawErrorData, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 