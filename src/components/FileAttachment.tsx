import React from 'react';
import { FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export function FileAttachment({ file, className = '' }: FileAttachmentProps) {
  const handleDownload = () => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg p-3 bg-gray-50 ${className}`}>
      {isImageFile(file.type) && file.url ? (
        // Image preview
        <div className="space-y-2">
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full max-h-48 rounded-lg object-contain"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </div>
              </div>
            </div>
            {file.url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        // Regular file display
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {getFileIcon(file.type)}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </div>
              <div className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </div>
            </div>
          </div>
          {file.url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
            >
              <DownloadIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 