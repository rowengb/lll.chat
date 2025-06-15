import React from 'react';
import { ImageIcon } from 'lucide-react';

export const ImageSkeleton: React.FC = () => {
  return (
    <div className="flex justify-start">
      <div className="w-full flex">
        <div className="max-w-full rounded-2xl bg-muted px-5 py-3 shadow-sm">
          <div className="flex flex-col space-y-3">
            {/* Image placeholder */}
            <div className="relative w-64 h-64 bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/20 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden">
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
              
              {/* Image icon */}
              <div className="flex flex-col items-center space-y-2 text-muted-foreground/50">
                <ImageIcon className="h-8 w-8" />
                <div className="text-sm font-medium">Generating image...</div>
              </div>
              
              {/* Animated dots overlay */}
              <div className="absolute bottom-3 left-3 flex items-center space-x-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40 animation-delay-100"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40 animation-delay-200"></div>
              </div>
            </div>
            
            {/* Status text */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"></div>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground animation-delay-100"></div>
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground animation-delay-200"></div>
              </div>
              <span className="animate-pulse">Creating your image with AI...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 