import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DownloadIcon, ExternalLinkIcon, EyeIcon } from 'lucide-react';
import { ImageSkeleton } from './ImageSkeleton';
import { useImageStore } from '@/stores/imageStore';
import { FileViewerModal } from './FileViewerModal';
import { FileAttachmentData } from './FileAttachment';

interface MessageImageProps {
  imageUrl: string;
  alt?: string;
}

export const MessageImage: React.FC<MessageImageProps> = ({ imageUrl, alt = "Generated image" }) => {
  const { getImageState, setImageLoaded, setImageError } = useImageStore();
  const { isLoaded, hasError } = getImageState(imageUrl);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(imageUrl);
  };

  const handleImageError = () => {
    setImageError(imageUrl);
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening modal when clicking download
    try {
      const response = await fetch(imageUrl);
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

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening modal when clicking open in new tab
    window.open(imageUrl, '_blank');
  };

  if (hasError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md">
        <p className="text-red-700 dark:text-red-300 text-sm">Failed to load generated image</p>
      </div>
    );
  }

  // Show skeleton while generating OR while the actual image is loading
  if (imageUrl === "GENERATING" || !isLoaded) {
    return (
      <>
        <ImageSkeleton />
        {/* Preload the actual image in the background when we have a real URL */}
        {imageUrl !== "GENERATING" && (
          <img
            src={imageUrl}
            alt={alt}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="hidden"
          />
        )}
      </>
    );
  }

  // Create a file object for the FileViewerModal
  const fileData: FileAttachmentData = {
    id: `generated-image-${Date.now()}`,
    name: `generated-image-${Date.now()}.png`,
    type: 'image/png',
    size: 0, // We don't know the size, but it's not critical for viewing
    url: imageUrl,
  };

  // Only show the actual image when it's fully loaded
  return (
    <>
      <div className="relative max-w-lg group/image cursor-pointer" onClick={handleImageClick}>
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto max-h-[300px] object-contain rounded-lg"
        />
        
        {/* Overlay with view hint */}
        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
          <div className="opacity-0 group-hover/image:opacity-100 transition-opacity">
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
              <EyeIcon className="h-6 w-6 text-gray-700" />
            </div>
          </div>
        </div>
        
        {/* Action buttons - shown on hover */}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200">
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

      {/* File Viewer Modal */}
      <FileViewerModal
        file={fileData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        canDelete={false}
      />
    </>
  );
}; 