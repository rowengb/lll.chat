import React, { useRef, useState, useCallback } from 'react';
import { PaperclipIcon, XIcon, FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/utils/trpc';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { useUploadStore, UploadStatus } from '@/stores/uploadStore';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
  status: UploadStatus;
  progress?: number;
  error?: string;
  originalFile?: File;
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
  const uploads = useUploadStore((s) => s.uploads);
  const addUpload = useUploadStore((s) => s.addUpload);
  const updateProgress = useUploadStore((s) => s.updateProgress);
  const updateStatus = useUploadStore((s) => s.updateStatus);
  const updateError = useUploadStore((s) => s.updateError);
  const removeUpload = useUploadStore((s) => s.removeUpload);

  const generateUploadUrl = trpc.files.generateUploadUrl.useMutation();
  const createFile = trpc.files.createFile.useMutation();

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles = Array.from(selectedFiles);
    // Add all files to the upload store instantly as 'pending'
    const tempIds = newFiles.map(file => {
      const tempId = uuidv4();
      addUpload({
        id: tempId,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      return { tempId, file };
    });

    // Check file count limit
    if (files.length + newFiles.length > maxFiles) {
      tempIds.forEach(({ tempId }) => updateError(tempId, `Maximum ${maxFiles} files allowed`));
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate files
    const validFiles: { tempId: string, file: File }[] = [];
    for (const { tempId, file } of tempIds) {
      updateStatus(tempId, 'validating');
      if (file.size > maxFileSize) {
        updateError(tempId, `File is too large. Max size is ${formatFileSize(maxFileSize)}`);
        toast.error(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
        continue;
      }
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });
      if (!isValidType) {
        updateError(tempId, `File type not supported`);
        toast.error(`File type "${file.type}" is not supported`);
        continue;
      }
      validFiles.push({ tempId, file });
    }

    setIsUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];
      for (const { tempId, file } of validFiles) {
        updateStatus(tempId, 'uploading');
        // Generate upload URL
        const uploadUrl = await generateUploadUrl.mutateAsync();
        // Upload file to Convex storage with progress
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        const progressHandler = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            updateProgress(tempId, percent);
          }
        };
        xhr.upload.addEventListener('progress', progressHandler);
        const uploadPromise = new Promise<{ storageId: string }>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error(`Failed to upload ${file.name}`));
            }
          };
          xhr.onerror = () => reject(new Error(`Failed to upload ${file.name}`));
        });
        xhr.send(file);
        try {
          const { storageId } = await uploadPromise;
          updateProgress(tempId, 100);
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
            status: 'done',
          });
          updateStatus(tempId, 'done');
          setTimeout(() => removeUpload(tempId), 1000);
        } catch (err) {
          updateError(tempId, 'Upload failed');
          setTimeout(() => removeUpload(tempId), 2000);
        }
      }
      onFilesChange([...files, ...uploadedFiles]);
      if (uploadedFiles.length > 0) toast.success(`${uploadedFiles.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [files, maxFiles, maxFileSize, acceptedTypes, onFilesChange, generateUploadUrl, createFile, addUpload, updateProgress, updateStatus, updateError, removeUpload]);

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
          ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80'}
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
        
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
          <PaperclipIcon className="h-4 w-4" />
          <span>
            {isUploading ? 'Uploading...' : 'Click or drag files to upload'}
          </span>
        </div>
        
                  <div className="text-xs text-muted-foreground text-center mt-1">
          Max {maxFiles} files, {formatFileSize(maxFileSize)} each
        </div>
      </div>

      {/* Uploaded Files List */}
      {(uploads.length > 0 || files.length > 0) && (
        <div className="space-y-1">
          {/* Uploading files (pending) */}
          {uploads.map((file) => (
            <div
              key={file.id}
              className={`flex items-center justify-between p-2 bg-muted rounded-lg border ${file.status === 'error' ? 'border-destructive bg-destructive/10' : 'opacity-80'}`}
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </div>
                  <div className="w-full bg-muted rounded h-2 mt-1">
                    <div
                      className={`h-2 rounded transition-all ${file.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${file.progress || 0}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-1 text-right ${file.status === 'error' ? 'text-destructive' : 'text-primary'}`}
                  >
                    {file.status === 'error' ? (file.error || 'Error') : `${file.progress || 0}%`}
                  </div>
                  {file.status === 'pending' && <div className="text-xs text-muted-foreground mt-1">Waiting...</div>}
                  {file.status === 'validating' && <div className="text-xs text-muted-foreground mt-1">Validating...</div>}
                  {file.status === 'uploading' && <div className="text-xs text-primary/70 mt-1">Uploading...</div>}
                  {file.status === 'done' && <div className="text-xs text-green-600 dark:text-green-400 mt-1">Done</div>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted cursor-not-allowed"
                disabled
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {/* Uploaded files */}
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-muted rounded-lg border"
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
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
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
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