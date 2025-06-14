import React, { useRef, useState, useEffect } from 'react';
import { ArrowUpIcon, PaperclipIcon, XIcon, FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon, FileSpreadsheetIcon, GlobeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelSelector } from './ModelSelector';
import { UploadedFile } from './FileUpload';
import toast from 'react-hot-toast';
import { trpc } from '@/utils/trpc';
import { v4 as uuidv4 } from 'uuid';
import { useUploadStore } from '@/stores/uploadStore';
import { FileViewerModal } from './FileViewerModal';
import { createPortal } from 'react-dom';

interface ChatboxProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
  searchGroundingEnabled?: boolean;
  onSearchGroundingChange?: (enabled: boolean) => void;
}

// Circular progress component
const CircularProgress = ({ progress, size = 32, strokeWidth = 3, children }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-300"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-500 transition-all duration-300 ease-out"
          strokeLinecap="round"
        />
      </svg>
      {/* Content in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// Pending loader animation component
const PendingLoader = ({ size = 24 }: { size?: number }) => {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" style={{ width: size, height: size }}></div>
    </div>
  );
};

// Get file type icon
const getFileIcon = (type: string, className = "h-4 w-4") => {
  if (type.startsWith('image/')) return <ImageIcon className={`${className} text-green-600`} />;
  if (type.startsWith('video/')) return <VideoIcon className={`${className} text-purple-600`} />;
  if (type.startsWith('audio/')) return <MusicIcon className={`${className} text-orange-600`} />;
  if (type.includes('pdf')) return <FileTextIcon className={`${className} text-red-600`} />;
  if (type.includes('document') || type.includes('word')) return <FileTextIcon className={`${className} text-blue-600`} />;
  if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheetIcon className={`${className} text-green-600`} />;
  if (type.includes('text')) return <FileTextIcon className={`${className} text-gray-600`} />;
  return <FileIcon className={`${className} text-gray-600`} />;
};

// Image preview component
const ImagePreview = ({ file, onRemove, onClick }: { file: any; onRemove: () => void; onClick?: () => void }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file.storageId) {
      // Create a blob URL for preview - you might need to fetch the actual image URL from your backend
      // For now, we'll create a placeholder or use the file's URL if available
      if (file.url) {
        setImageUrl(file.url);
      } else {
        // Create object URL from file if it's still a File object
        const fileObj = file.originalFile;
        if (fileObj instanceof File) {
          const url = URL.createObjectURL(fileObj);
          setImageUrl(url);
          return () => URL.revokeObjectURL(url);
        }
      }
    }
  }, [file]);

  return (
    <div className="relative group">
      <div 
        className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-300 p-0.5 cursor-pointer hover:border-gray-400 transition-colors"
        onClick={onClick}
      >
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={file.name}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-md">
            <ImageIcon className="h-5 w-5 text-gray-400" />
          </div>
        )}
      </div>
      {/* Remove button on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <XIcon className="h-2.5 w-2.5 text-white" />
      </button>
    </div>
  );
};

// Compact file item component for loading/non-image files
const CompactFileItem = ({ file, onRemove, isLoading = false, onClick }: { file: any; onRemove?: () => void; isLoading?: boolean; onClick?: () => void }) => {
  return (
    <div className="relative group">
      <div 
        className={`${isLoading ? 'min-w-48' : 'min-w-32'} h-12 rounded-lg border px-3 py-2 transition-all duration-300 ${
          file.status === 'error' ? 'bg-red-50 border-red-200' : 
          file.isUploading ? 'bg-blue-50 border-blue-200' : 
          'bg-gray-50 border-gray-200 hover:border-gray-300 cursor-pointer'
        }`}
        onClick={!file.isUploading ? onClick : undefined}
      >
        <div className="flex items-center gap-3 h-full">
          {/* Icon or Progress */}
          <div className="flex-shrink-0">
            {file.isUploading ? (
              file.status === 'error' ? (
                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                  <XIcon className="h-3 w-3 text-white" />
                </div>
              ) : file.status === 'pending' || file.status === 'validating' ? (
                <PendingLoader size={24} />
                             ) : file.status === 'done' ? (
                 <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                   <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                   </svg>
                 </div>
              ) : (
                <CircularProgress progress={file.progress || 0} size={24} strokeWidth={2} />
              )
            ) : (
              getFileIcon(file.type, "h-5 w-5")
            )}
          </div>
          
          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {file.name}
            </div>
            <div className="text-xs text-gray-500">
              {file.size < 1024 * 1024 
                ? `${(file.size / 1024).toFixed(0)}KB` 
                : `${(file.size / 1024 / 1024).toFixed(1)}MB`}
            </div>
          </div>
        </div>
      </div>
      
      {/* Remove button */}
      {onRemove && !file.isUploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XIcon className="h-2.5 w-2.5 text-white" />
        </button>
      )}
    </div>
  );
};

export function Chatbox({
  input,
  onInputChange,
  onSubmit,
  uploadedFiles,
  onFilesChange,
  selectedModel,
  onModelChange,
  isLoading,
  inputRef,
  className = "",
  searchGroundingEnabled = true,
  onSearchGroundingChange
}: ChatboxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Check if the selected model supports Google Search grounding
  const supportsGrounding = selectedModel.includes('gemini-2.0') || 
                           selectedModel.includes('gemini-2.5') || 
                           selectedModel.includes('gemini-2-0') || 
                           selectedModel.includes('gemini-2-5');
  
  // Upload store for progress tracking
  const uploads = useUploadStore((s) => s.uploads);
  const addUpload = useUploadStore((s) => s.addUpload);
  const updateProgress = useUploadStore((s) => s.updateProgress);
  const updateStatus = useUploadStore((s) => s.updateStatus);
  const updateError = useUploadStore((s) => s.updateError);
  const removeUpload = useUploadStore((s) => s.removeUpload);
  
  // File handling mutations
  const generateUploadUrl = trpc.files.generateUploadUrl.useMutation();
  const createFile = trpc.files.createFile.useMutation();
  const deleteFile = trpc.files.deleteFile.useMutation();

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Immediately add all files to upload store for instant feedback
    const fileUploads = Array.from(files).map(file => {
      const tempId = uuidv4();
      addUpload({
        id: tempId,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      return { tempId, file };
    });

    for (const { tempId, file } of fileUploads) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        updateError(tempId, `File is too large. Maximum size is 10MB.`);
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        setTimeout(() => removeUpload(tempId), 3000);
        continue;
      }

      // Check if we're at the limit
      if (uploadedFiles.length + uploads.filter(u => u.status === 'done').length >= 5) {
        updateError(tempId, "Maximum 5 files allowed per message.");
        toast.error("Maximum 5 files allowed per message.");
        setTimeout(() => removeUpload(tempId), 3000);
        break;
      }

      try {
        updateStatus(tempId, 'uploading');
        
        // Generate upload URL
        const uploadUrl = await generateUploadUrl.mutateAsync();
        
        // Upload file with progress tracking using XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type);
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            updateProgress(tempId, percent);
          }
        });

        const uploadPromise = new Promise<{ storageId: string }>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          };
          xhr.onerror = () => reject(new Error(`Failed to upload ${file.name}`));
        });

        xhr.send(file);
        const { storageId } = await uploadPromise;

        updateProgress(tempId, 100);
        updateStatus(tempId, 'done');

        // Create file record in database
        const fileRecord = await createFile.mutateAsync({
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
        });

        // Instead of adding to newFiles array, directly update the uploaded files
        // and keep the upload item in store with the real file ID
        const uploadedFile: UploadedFile = {
          id: fileRecord,
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
          status: 'done',
          originalFile: file, // Keep reference to original file for image preview
        };

        onFilesChange([...uploadedFiles, uploadedFile]);
        
        // Update the upload store item with the real file ID for seamless transition
        // We'll keep it briefly to show the completion state, then remove
        setTimeout(() => removeUpload(tempId), 2000);
        
      } catch (error) {
        console.error("Error uploading file:", error);
        updateError(tempId, `Failed to upload ${file.name}`);
        toast.error(`Failed to upload ${file.name}`);
        setTimeout(() => removeUpload(tempId), 3000);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      // Delete the file from storage and database
      await deleteFile.mutateAsync({ fileId });
      
      // Remove from local state
      onFilesChange(uploadedFiles.filter(f => f.id !== fileId));
      
      toast.success("File removed");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to remove file");
    }
  };

  const handleFileClick = (file: any) => {
    // Only show modal for completed files (not uploading)
    if (!file.isUploading) {
      // For now, we'll create a URL from the original file if available
      let fileForModal = file;
      
      // If file doesn't have URL but has originalFile, create object URL
      if (!file.url && file.originalFile instanceof File) {
        const objectUrl = URL.createObjectURL(file.originalFile);
        fileForModal = {
          ...file,
          url: objectUrl
        };
      }
      
      setSelectedFile(fileForModal);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    // Clean up object URL if it was created
    if (selectedFile?.url && selectedFile.url.startsWith('blob:')) {
      URL.revokeObjectURL(selectedFile.url);
    }
    setIsModalOpen(false);
    setSelectedFile(null);
  };



  // Combine uploads and uploaded files for unified display
  const allFiles = [
    ...uploadedFiles.filter(file => 
      // Only show uploaded files that don't have a corresponding upload in progress
      !uploads.some(upload => upload.name === file.name && upload.size === file.size)
    ).map(file => ({
      ...file,
      isUploading: false,
      progress: 100,
    })),
    ...uploads.map(upload => ({
      ...upload,
      isUploading: true,
    }))
  ];

  return (
    <div 
      className={`relative chatbox-stable shadow-xl ${className}`}
      style={{
        transform: 'translateY(-4px)',
        borderRadius: '20px'
      }}
    >
      {/* Glassmorphic background with subtle white overlay */}
      <div 
        className="absolute inset-0 bg-white/20 backdrop-blur-xl border border-gray-300"
        style={{
          borderRadius: '20px',
          clipPath: 'inset(0 round 20px)'
        }}
      />
      {/* Content */}
      <div className="relative z-10 px-5 py-4">
      <form onSubmit={onSubmit}>
        {/* Unified Files Display - All in rows */}
        {allFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2 items-start">
              {allFiles.map((file) => {
                // Show images as squares only when completed
                if (file.type.startsWith('image/') && !file.isUploading) {
                  return (
                    <ImagePreview
                      key={`image-${file.id}`}
                      file={file}
                      onRemove={() => handleRemoveFile(file.id)}
                      onClick={() => handleFileClick(file)}
                    />
                  );
                }
                
                // All other files (loading or completed non-images) show as full-width cards
                return (
                  <CompactFileItem
                    key={file.isUploading ? file.id : `file-${file.id}`}
                    file={file}
                    onRemove={!file.isUploading ? () => handleRemoveFile(file.id) : undefined}
                    isLoading={file.isUploading}
                    onClick={() => handleFileClick(file)}
                  />
                );
              })}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <div className="textarea-container">
            <textarea
              ref={inputRef as any}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="w-full border-0 bg-transparent focus:outline-none focus:ring-0 focus:border-transparent focus:shadow-none text-base py-0 px-0 transition-colors resize-none hidden-scrollbar"
              style={{ 
                border: 'none', 
                outline: 'none', 
                boxShadow: 'none',
                height: '20px',
                minHeight: '20px',
                maxHeight: '120px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e as any);
                }
              }}
            />
          </div>
          <Button 
            type="submit" 
            disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
            className="rounded-xl h-12 w-12 bg-blue-500 hover:bg-blue-600 shadow-sm transition-all"
            size="sm"

          >
            <ArrowUpIcon className="h-6 w-6" strokeWidth={1.8} strokeLinecap="square" />
          </Button>
        </div>
        
        <div className="border-t border-gray-100 mt-2 pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
            />
            {supportsGrounding && onSearchGroundingChange && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSearchGroundingChange(!searchGroundingEnabled)}
                disabled={isLoading}
                className={`h-8 px-3 transition-colors border rounded-full ${
                  searchGroundingEnabled 
                    ? 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-100 hover:border-gray-300'
                }`}
                title={searchGroundingEnabled ? "Disable Google Search grounding" : "Enable Google Search grounding"}
              >
                <GlobeIcon className="h-4 w-4 mr-1" />
                Search
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAttachClick}
              disabled={isLoading}
              className="h-8 px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-100 hover:border-gray-300 transition-colors rounded-full"
            >
              <PaperclipIcon className="h-4 w-4 mr-1" />
              Attach
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
          </div>
          <div className="text-xs text-gray-500">
            Press Enter to send
          </div>
        </div>
      </form>
      
      {/* File Viewer Modal */}
      {selectedFile && isModalOpen && createPortal(
        <FileViewerModal
          file={selectedFile}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />,
        document.body
      )}
      </div>
    </div>
  );
} 