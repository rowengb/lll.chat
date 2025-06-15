import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DownloadIcon, ExternalLinkIcon, EyeIcon } from 'lucide-react';
import { trpc } from '@/utils/trpc';

interface MessageImageProps {
  imageUrl?: string;
  fileId?: string;
  alt?: string;
}

export const MessageImage: React.FC<MessageImageProps> = ({ imageUrl, fileId, alt = "Generated image" }) => {
  // Fetch file data from Convex if fileId is provided
  const { data: fileData } = trpc.files.getFile.useQuery(
    { fileId: fileId! },
    { enabled: !!fileId }
  );

  const finalImageUrl = imageUrl || fileData?.url;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = async () => {
    if (!finalImageUrl) return;
    try {
      const response = await fetch(finalImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const handleOpenInNewTab = () => {
    if (!finalImageUrl) return;
    window.open(finalImageUrl, '_blank');
  };

  if (!finalImageUrl) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4 max-w-md">
        <p className="text-gray-700 dark:text-gray-300 text-sm">Loading image...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md">
        <p className="text-red-700 dark:text-red-300 text-sm">Failed to load generated image</p>
      </div>
    );
  }

  return (
    <div className="relative max-w-lg group">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      
      <img
        src={finalImageUrl}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-auto rounded-lg shadow-lg transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Action buttons - shown on hover */}
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
          title="Download image"
        >
          <DownloadIcon className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleOpenInNewTab}
          className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white border-0"
          title="Open in new tab"
        >
          <ExternalLinkIcon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}; 