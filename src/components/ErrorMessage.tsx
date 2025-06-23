import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  rawErrorData?: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, rawErrorData }) => {
  const [showRawData, setShowRawData] = useState(false);

  return (
    <div className="w-full max-w-full overflow-hidden px-4 py-2">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="text-sm leading-relaxed">
            <strong>Error:</strong> {message}
          </div>
          
          {rawErrorData && (
            <div className="border border-destructive/20 rounded-lg overflow-hidden w-full">
              <button
                onClick={() => setShowRawData(!showRawData)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showRawData ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Search className="h-4 w-4" />
                  <span>View Raw API Response</span>
                </div>
              </button>
              
              {showRawData && (
                <div className="border-t border-destructive/20 w-full overflow-hidden">
                  <div className="max-h-64 overflow-auto bg-muted/50 p-3 w-full">
                    <div className="w-full overflow-hidden">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all w-full" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
                        <code className="block w-full">{JSON.stringify(rawErrorData, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 