import React, { useRef, useState, useCallback } from 'react';
import { PaperclipIcon, XIcon, FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/utils/trpc';
import toast from 'react-hot-toast';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
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

export function FileUpload({
  onFilesChange,
  files,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ['image/*', 'text/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const generateUploadUrl = trpc.files.generateUploadUrl.useMutation();
  const createFile = trpc.files.createFile.useMutation();

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = Array.from(selectedFiles);
    
    // Check file count limit
    if (files.length + newFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate files
    const validFiles = newFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast.error(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
        return false;
      }
      
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });
      
      if (!isValidType) {
        toast.error(`File type "${file.type}" is not supported`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (const file of validFiles) {
        // Generate upload URL
        const uploadUrl = await generateUploadUrl.mutateAsync();
        
        // Upload file to Convex storage
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!result.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await result.json();

        // Create file record in database
        const fileRecord = await createFile.mutateAsync({
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
        });

        uploadedFiles.push({
          id: fileRecord,
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
        });
      }

      onFilesChange([...files, ...uploadedFiles]);
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [files, maxFiles, maxFileSize, acceptedTypes, onFilesChange, generateUploadUrl, createFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled) return;
    
    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  }, [disabled, handleFileSelect]);

  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = files.filter(file => file.id !== fileId);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className="space-y-2">
      {/* File Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-3 transition-colors cursor-pointer
          ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <PaperclipIcon className="h-4 w-4" />
          <span>
            {isUploading ? 'Uploading...' : 'Click or drag files to upload'}
          </span>
        </div>
        
        <div className="text-xs text-gray-500 text-center mt-1">
          Max {maxFiles} files, {formatFileSize(maxFileSize)} each
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border"
            >
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
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                disabled={disabled}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 