import React from 'react';

interface ImageSkeletonProps {
  className?: string;
}

export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({ className = "" }) => {
  console.log("🎨 [ImageSkeleton] Rendering skeleton loader");
  return (
    <div className={`relative max-w-lg group ${className}`}>
      <div className="relative bg-muted rounded-lg overflow-hidden" style={{ width: '300px', height: '300px', maxWidth: '300px', maxHeight: '300px' }}>
        {/* Pulsating background */}
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60 animate-pulse" />
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" 
             style={{ backgroundSize: '200% 100%' }} />
        
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground/50 animate-pulse">
            <svg 
              className="w-12 h-12" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" 
              />
            </svg>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-xs text-muted-foreground/70 text-center animate-pulse">
            Generating image...
          </div>
        </div>
      </div>
    </div>
  );
}; 