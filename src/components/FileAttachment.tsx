import React, { useState } from 'react';
import { FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon, DownloadIcon, EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileViewerModal } from './FileViewerModal';

export interface FileAttachmentData {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
}

interface FileAttachmentProps {
  file: FileAttachmentData;
  className?: string;
  onDelete?: (fileId: string) => void;
  canDelete?: boolean;
  showPreview?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (type.startsWith('video/')) return <VideoIcon className="h-4 w-4" />;
  if (type.startsWith('audio/')) return <MusicIcon className="h-4 w-4" />;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) {
    return <FileTextIcon className="h-4 w-4" />;
  }
  return <FileIcon className="h-4 w-4" />;
};

const isImageFile = (type: string) => type.startsWith('image/');
const isViewableFile = (type: string) => {
  return type.startsWith('image/') || 
         type.startsWith('video/') || 
         type.startsWith('audio/') ||
         type === 'application/pdf' ||
         type.startsWith('text/') ||
         type.includes('document') ||
         type.includes('spreadsheet') ||
         type.includes('presentation');
};

export function FileAttachment({ 
  file, 
  className = '', 
  onDelete,
  canDelete = false,
  showPreview = true 
}: FileAttachmentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (file.url && !isDownloading) {
      setIsDownloading(true);
      try {
        // Fetch the file as a blob to ensure proper download
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error('Failed to fetch file');
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to direct link if blob download fails
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        setIsDownloading(false);
      }
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleFileClick = () => {
    if (isViewableFile(file.type) && file.url) {
      setIsModalOpen(true);
    }
  };

  const canView = isViewableFile(file.type) && file.url;

  return (
    <>
      <div 
        className={`border border-gray-200 rounded-lg p-3 bg-gray-50 transition-colors group/attachment ${
          canView ? 'hover:bg-gray-100 cursor-pointer' : ''
        } ${className}`}
        onClick={handleFileClick}
      >
        {isImageFile(file.type) && file.url && showPreview ? (
          // Image preview with enhanced interaction
          <div className="w-full">
            <div className="relative w-full">
              <img
                src={file.url}
                alt={file.name}
                className="w-full max-h-48 rounded-lg object-contain block"
              />
              {canView && (
                <div className="absolute inset-0 bg-black/0 group-hover/attachment:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover/attachment:opacity-100 transition-opacity">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                      <EyeIcon className="h-5 w-5 text-gray-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2 w-full">
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canView && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleView}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                      title="View file"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {file.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title={isDownloading ? "Downloading..." : "Download file"}
                    >
                      {isDownloading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      ) : (
                        <DownloadIcon className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Regular file display with enhanced interaction
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                  {canView && (
                    <span className="ml-2 text-primary">• Click to view</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleView}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                  title="View file"
                >
                  <EyeIcon className="h-4 w-4" />
                </Button>
              )}
              {file.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title={isDownloading ? "Downloading..." : "Download file"}
                >
                  {isDownloading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Viewer Modal */}
      <FileViewerModal
        file={file}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDelete={onDelete}
        canDelete={canDelete}
      />
    </>
  );
} 