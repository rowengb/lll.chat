import React, { useRef, useState, useEffect } from 'react';
import { ArrowUpIcon, PaperclipIcon, XIcon, FileIcon, ImageIcon, FileTextIcon, VideoIcon, MusicIcon, FileSpreadsheetIcon, GlobeIcon, SquareIcon } from 'lucide-react';
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
  isStreaming?: boolean;
  onStop?: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
  searchGroundingEnabled?: boolean;
  onSearchGroundingChange?: (enabled: boolean) => void;
  onModelSelectorClick?: () => void;
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
          className="text-muted"
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
          className="text-primary transition-all duration-300 ease-out"
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
      <div className="animate-spin rounded-full border-2 border-muted border-t-primary" style={{ width: size, height: size }}></div>
    </div>
  );
};

// Get file type icon
const getFileIcon = (type: string, className = "h-4 w-4") => {
  if (type.startsWith('image/')) return <ImageIcon className={`${className} text-green-600 dark:text-green-400`} />;
  if (type.startsWith('video/')) return <VideoIcon className={`${className} text-purple-600 dark:text-purple-400`} />;
  if (type.startsWith('audio/')) return <MusicIcon className={`${className} text-orange-600 dark:text-orange-400`} />;
  if (type.includes('pdf')) return <FileTextIcon className={`${className} text-red-600 dark:text-red-400`} />;
  if (type.includes('document') || type.includes('word')) return <FileTextIcon className={`${className} text-primary`} />;
  if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheetIcon className={`${className} text-green-600 dark:text-green-400`} />;
  if (type.includes('text')) return <FileTextIcon className={`${className} text-muted-foreground`} />;
  return <FileIcon className={`${className} text-muted-foreground`} />;
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
    <div className="relative group flex-shrink-0">
      <div 
        className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border p-0.5 cursor-pointer hover:border-border/80 transition-colors"
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
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
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
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <XIcon className="h-2.5 w-2.5 text-destructive-foreground" />
      </button>
    </div>
  );
};

// Compact file item component for loading/non-image files
const CompactFileItem = ({ file, onRemove, isLoading = false, onClick }: { file: any; onRemove?: () => void; isLoading?: boolean; onClick?: () => void }) => {
  return (
    <div className="relative group">
      <div 
        className={`${isLoading ? 'min-w-48' : 'min-w-32'} sm:min-w-0 flex-shrink-0 h-12 rounded-lg border px-3 py-2 transition-all duration-300 ${
          file.status === 'error' ? 'bg-destructive/10 border-destructive/20' : 
          file.isUploading ? 'bg-primary/10 border-primary/20' : 
          'bg-muted border-border hover:border-border/80 cursor-pointer'
        }`}
        onClick={!file.isUploading ? onClick : undefined}
      >
        <div className="flex items-center gap-3 h-full">
          {/* Icon or Progress */}
          <div className="flex-shrink-0">
            {file.isUploading ? (
              file.status === 'error' ? (
                <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                  <XIcon className="h-3 w-3 text-destructive-foreground" />
                </div>
              ) : file.status === 'pending' || file.status === 'validating' ? (
                <PendingLoader size={24} />
                             ) : file.status === 'done' ? (
                 <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
                   <svg className="h-3.5 w-3.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="text-sm font-medium text-foreground truncate">
              {file.name}
            </div>
            <div className="text-xs text-muted-foreground">
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
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <XIcon className="h-2.5 w-2.5 text-destructive-foreground" />
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
  isStreaming = false,
  onStop,
  inputRef,
  className = "",
  searchGroundingEnabled = true,
  onSearchGroundingChange,
  onModelSelectorClick
}: ChatboxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
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

  // Handle paste events for file uploading (images and other supported types)
  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const filesToUpload: File[] = [];
    let hasText = false;
    let textContent = '';
    
    // Check each item in the clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item) continue;
      
      // Check for file types (images, documents, etc.)
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Check if it's a supported file type
          const supportedTypes = [
            'image/', // All image types
            'text/', // Text files
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
          ];
          
          const isSupported = supportedTypes.some(type => file.type.startsWith(type) || file.type === type);
          
          if (isSupported) {
            filesToUpload.push(file);
          } else {
            console.log(`📋 [PASTE] Unsupported file type: ${file.type}`);
            toast.error(`Unsupported file type: ${file.type}`);
          }
        }
      }
      
      // Check for text content that could be saved as a file
      else if (item.kind === 'string' && item.type === 'text/plain') {
        hasText = true;
        item.getAsString((text) => {
          textContent = text;
        });
      }
    }

    // Process files if found
    if (filesToUpload.length > 0) {
      // Prevent default paste behavior for files
      event.preventDefault();
      
      console.log(`📋 [PASTE] Processing ${filesToUpload.length} pasted file(s)`);
      
      // Track files being added in this paste operation
      let currentUploadedFiles = [...uploadedFiles];
      
      // Process each pasted file through the upload system sequentially
      for (const file of filesToUpload) {
        const tempId = uuidv4();
        
        // Generate a meaningful filename for pasted files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let fileName: string;
        
        if (file.name && file.name !== 'blob') {
          // Use original filename if available
          fileName = file.name;
        } else {
          // Generate filename based on type
          let extension = 'bin'; // Default extension
          
          if (file.type.startsWith('image/')) {
            extension = file.type.split('/')[1] || 'png';
            fileName = `pasted-image-${timestamp}.${extension}`;
          } else if (file.type.startsWith('text/')) {
            extension = 'txt';
            fileName = `pasted-text-${timestamp}.${extension}`;
          } else if (file.type === 'application/pdf') {
            extension = 'pdf';
            fileName = `pasted-document-${timestamp}.${extension}`;
          } else if (file.type.includes('word')) {
            extension = file.type.includes('openxmlformats') ? 'docx' : 'doc';
            fileName = `pasted-document-${timestamp}.${extension}`;
          } else if (file.type.includes('sheet') || file.type.includes('excel')) {
            extension = file.type.includes('openxmlformats') ? 'xlsx' : 'xls';
            fileName = `pasted-spreadsheet-${timestamp}.${extension}`;
          } else if (file.type === 'application/json') {
            extension = 'json';
            fileName = `pasted-data-${timestamp}.${extension}`;
          } else {
            fileName = `pasted-file-${timestamp}.${extension}`;
          }
        }
        
        addUpload({
          id: tempId,
          name: fileName,
          type: file.type,
          size: file.size,
        });

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          updateError(tempId, `File is too large. Maximum size is 10MB.`);
          toast.error(`Pasted file ${fileName} is too large. Maximum size is 10MB.`);
          setTimeout(() => removeUpload(tempId), 3000);
          continue;
        }

        // Check if we're at the limit (use local tracking for accurate count)
        const currentFiles = currentUploadedFiles.length + uploads.filter(u => u.status === 'done').length;
        if (currentFiles >= 5) {
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
            xhr.onerror = () => reject(new Error(`Failed to upload pasted file`));
          });

          xhr.send(file);
          const { storageId } = await uploadPromise;

          updateProgress(tempId, 100);
          updateStatus(tempId, 'done');

          // Create file record in database
          const fileRecord = await createFile.mutateAsync({
            name: fileName,
            type: file.type,
            size: file.size,
            storageId,
          });

          // Create uploaded file object
          const uploadedFile: UploadedFile = {
            id: fileRecord,
            name: fileName,
            type: file.type,
            size: file.size,
            storageId,
            status: 'done',
            originalFile: file, // Keep reference to original file
          };

          // Add to local tracking and update state
          currentUploadedFiles.push(uploadedFile);
          onFilesChange([...currentUploadedFiles]);
          
          // Remove from upload store after a brief delay
          setTimeout(() => removeUpload(tempId), 2000);
          
        } catch (error) {
          console.error("Error uploading pasted file:", error);
          updateError(tempId, `Failed to upload pasted file`);
          toast.error(`Failed to upload pasted file`);
          setTimeout(() => removeUpload(tempId), 3000);
        }
      }
      
      // Show success message
      if (filesToUpload.length > 1) {
        toast.success(`${filesToUpload.length} files pasted and processed`);
      } else {
        const fileType = filesToUpload[0]?.type.startsWith('image/') ? 'Image' : 'File';
        toast.success(`${fileType} pasted and uploaded successfully`);
      }
    }
    
    // Handle text content - offer to save as file if it's substantial
    else if (hasText && textContent.trim().length > 100) {
      // Wait a bit for the text to be set
      setTimeout(() => {
        if (confirm(`Found ${textContent.length} characters of text content. Save as a text file?`)) {
          event.preventDefault();
          
          // Create a text file from the pasted content
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `pasted-text-${timestamp}.txt`;
          const textFile = new File([textContent], fileName, { type: 'text/plain' });
          
          // Process as a regular file upload
          const tempId = uuidv4();
          addUpload({
            id: tempId,
            name: fileName,
            type: 'text/plain',
            size: textFile.size,
          });
          
          // Upload the text file
          (async () => {
            try {
              updateStatus(tempId, 'uploading');
              
              const uploadUrl = await generateUploadUrl.mutateAsync();
              const xhr = new XMLHttpRequest();
              xhr.open('POST', uploadUrl, true);
              xhr.setRequestHeader('Content-Type', 'text/plain');
              
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
                xhr.onerror = () => reject(new Error(`Failed to upload text file`));
              });

              xhr.send(textFile);
              const { storageId } = await uploadPromise;

              updateProgress(tempId, 100);
              updateStatus(tempId, 'done');

              const fileRecord = await createFile.mutateAsync({
                name: fileName,
                type: 'text/plain',
                size: textFile.size,
                storageId,
              });

              const uploadedFile: UploadedFile = {
                id: fileRecord,
                name: fileName,
                type: 'text/plain',
                size: textFile.size,
                storageId,
                status: 'done',
                originalFile: textFile,
              };

              onFilesChange([...uploadedFiles, uploadedFile]);
              setTimeout(() => removeUpload(tempId), 2000);
              toast.success('Text content saved as file');
              
            } catch (error) {
              console.error("Error uploading text file:", error);
              updateError(tempId, `Failed to upload text file`);
              toast.error(`Failed to upload text file`);
              setTimeout(() => removeUpload(tempId), 3000);
            }
          })();
        }
      }, 100);
    }
  };

  // Handle drag and drop events for file uploading
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set to false if we're leaving the main container
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    console.log(`🎯 [DROP] Processing ${files.length} dropped file(s)`);

    // Validate file types
    const supportedTypes = [
      'image/', // All image types
      'text/', // Text files
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
    ];

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    files.forEach(file => {
      const isSupported = supportedTypes.some(type => 
        file.type.startsWith(type) || file.type === type
      );
      
      if (isSupported) {
        validFiles.push(file);
      } else {
        invalidFiles.push(`${file.name} (${file.type})`);
      }
    });

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      toast.error(`Unsupported file types: ${invalidFiles.join(', ')}`);
    }

    if (validFiles.length === 0) return;

    // Track files being added in this drop operation
    let currentUploadedFiles = [...uploadedFiles];

    // Process each dropped file through the upload system sequentially
    for (const file of validFiles) {
      const tempId = uuidv4();
      
      addUpload({
        id: tempId,
        name: file.name,
        type: file.type,
        size: file.size,
      });

      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        updateError(tempId, `File is too large. Maximum size is 10MB.`);
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        setTimeout(() => removeUpload(tempId), 3000);
        continue;
      }

      // Check if we're at the limit (use local tracking for accurate count)
      const currentFiles = currentUploadedFiles.length + uploads.filter(u => u.status === 'done').length;
      if (currentFiles >= 5) {
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

        // Create uploaded file object
        const uploadedFile: UploadedFile = {
          id: fileRecord,
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
          status: 'done',
          originalFile: file,
        };

        // Add to local tracking and update state
        currentUploadedFiles.push(uploadedFile);
        onFilesChange([...currentUploadedFiles]);
        
        // Remove from upload store after a brief delay
        setTimeout(() => removeUpload(tempId), 2000);
        
      } catch (error) {
        console.error("Error uploading dropped file:", error);
        updateError(tempId, `Failed to upload ${file.name}`);
        toast.error(`Failed to upload ${file.name}`);
        setTimeout(() => removeUpload(tempId), 3000);
      }
    }
    
    // Show success message
    if (validFiles.length > 1) {
      toast.success(`${validFiles.length} files dropped and processed`);
    } else {
      const fileType = validFiles[0]?.type.startsWith('image/') ? 'Image' : 'File';
      toast.success(`${fileType} dropped and uploaded successfully`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event as any);
    }
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
      className={`relative chatbox-stable ${className} ${
        isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''
      } rounded-t-[20px] sm:rounded-t-[20px] sm:rounded-b-none`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Enhanced glassmorphic background with complex styling */}
      <div 
        className={`absolute inset-0 bg-white/50 dark:bg-secondary/[0.045] backdrop-blur-md border border-b-0 border-white/50 dark:border-[hsl(0,0%,83%)]/[0.04] outline outline-4 outline-blue-500/20 dark:outline-blue-400/25 ${
          isDragOver ? 'bg-primary/5 border-primary/30' : ''
        }`}
        style={{
          borderRadius: '16px 16px 0 0',
          boxShadow: `
            rgba(0, 0, 0, 0.1) 0px 80px 50px 0px,
            rgba(0, 0, 0, 0.07) 0px 50px 30px 0px,
            rgba(0, 0, 0, 0.06) 0px 30px 15px 0px,
            rgba(0, 0, 0, 0.04) 0px 15px 8px,
            rgba(0, 0, 0, 0.04) 0px 6px 4px,
            rgba(0, 0, 0, 0.02) 0px 2px 2px
          `
        }}
      />
      

      
      {/* Drag overlay */}
      {isDragOver && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm z-20 rounded-t-xl"
        >
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
              <PaperclipIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-base font-medium text-primary">Drop files here</p>
            <p className="text-xs text-muted-foreground mt-1">
              Images, PDFs, documents, and more
            </p>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 px-4 pt-3">
      <form onSubmit={onSubmit}>
        {/* Unified Files Display - All in rows */}
        {allFiles.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-nowrap sm:flex-wrap gap-2 items-start overflow-x-auto pb-1 pt-2 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
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
        
        <div className="flex flex-row items-center gap-3">
          <div className="textarea-container flex-1">
            <textarea
              ref={inputRef as any}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="w-full border-0 bg-transparent focus:outline-none focus:ring-0 focus:border-transparent focus:shadow-none text-base py-0 px-0 transition-colors resize-none hidden-scrollbar text-foreground placeholder:text-muted-foreground"
              style={{ 
                border: 'none', 
                outline: 'none', 
                boxShadow: 'none',
                height: '20px',
                minHeight: '20px',
                maxHeight: '120px'
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
          </div>
          <Button 
            type={isStreaming ? "button" : "submit"}
            onClick={isStreaming ? onStop : undefined}
            disabled={isStreaming ? false : ((!input.trim() && uploadedFiles.length === 0) || isLoading)}
            className={`h-12 w-12 shadow-sm transition-all ${
              isStreaming 
                ? 'bg-destructive hover:bg-destructive/90' 
                : 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 text-white dark:text-black'
            }`}
            style={{ borderRadius: '12px' }}
            size="sm"
            title={isStreaming ? "Stop generation" : "Send message"}
          >
            {isStreaming ? (
              <SquareIcon className="h-5 w-5 text-destructive-foreground" fill="currentColor" />
            ) : (
            <ArrowUpIcon className="h-6 w-6 text-primary-foreground" strokeWidth={1.8} strokeLinecap="square" />
            )}
          </Button>
        </div>
        
        <div className="border-t border-border/80 mt-2 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex flex-row items-center gap-2">
            <div className="flex-1 sm:flex-initial sm:w-auto">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                onClick={onModelSelectorClick}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {supportsGrounding && onSearchGroundingChange && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSearchGroundingChange(!searchGroundingEnabled)}
                  disabled={isLoading}
                  className={`h-7 transition-colors border rounded-full ${
                    searchGroundingEnabled 
                      ? 'text-primary bg-primary/10 border-primary/20 hover:bg-primary/20 hover:border-primary/30' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border hover:border-border/80'
                  } px-5 sm:px-3`}
                  title={searchGroundingEnabled ? "Disable Google Search grounding" : "Enable Google Search grounding"}
                >
                  <GlobeIcon className="h-3.5 w-3.5" />
                  <span className="ml-1 hidden sm:inline">Search</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAttachClick}
                disabled={isLoading}
                className="h-7 text-muted-foreground hover:text-foreground hover:bg-muted border border-border hover:border-border/80 transition-colors rounded-full px-5 sm:px-3"
              >
                <PaperclipIcon className="h-3.5 w-3.5" />
                <span className="ml-1 hidden sm:inline">Attach</span>
              </Button>
            </div>
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