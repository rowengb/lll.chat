import React from 'react';
import { AlertTriangle, Key, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiKeyWarningBannerProps {
  onNavigateToSettings: () => void;
  onDismiss?: () => void;
  isDismissible?: boolean;
  shouldShake?: boolean;
}

export function ApiKeyWarningBanner({ 
  onNavigateToSettings, 
  onDismiss, 
  isDismissible = false,
  shouldShake = false
}: ApiKeyWarningBannerProps) {
  return (
    <div className={`absolute top-8 left-1/2 transform -translate-x-1/2 z-50 ${shouldShake ? 'animate-shake' : ''}`}>
      <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 backdrop-blur-sm max-w-lg mx-auto">
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              API Key Required
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Add an API key to start chatting with AI models
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={onNavigateToSettings}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700 text-sm px-4 py-2.5 h-auto rounded-lg font-medium shadow-sm"
            >
              <Key className="h-4 w-4 mr-2" />
              Add Keys
            </Button>
            
            {isDismissible && onDismiss && (
              <Button
                onClick={onDismiss}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 h-auto rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 