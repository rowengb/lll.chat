import React from 'react';
import { trpc } from '@/utils/trpc';
import { FileAttachment } from './FileAttachment';

interface FileAttachmentWithUrlProps {
  fileId: string;
}

export function FileAttachmentWithUrl({ fileId }: FileAttachmentWithUrlProps) {
  const { data: file, isLoading, error } = trpc.files.getFile.useQuery({ fileId });

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 animate-pulse">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <div className="text-sm text-gray-500">
          Failed to load file attachment
        </div>
      </div>
    );
  }

  return (
    <FileAttachment 
      file={{
        id: file._id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url || undefined,
        storageId: file.storageId,
      }}
    />
  );
} 