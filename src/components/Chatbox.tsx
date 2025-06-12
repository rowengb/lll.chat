import React, { useRef } from 'react';
import { ArrowUpIcon, PaperclipIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelSelector } from './ModelSelector';
import { UploadedFile } from './FileUpload';
import toast from 'react-hot-toast';
import { trpc } from '@/utils/trpc';

interface ChatboxProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  uploadedFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  className?: string;
}

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
  className = ""
}: ChatboxProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File handling mutations
  const generateUploadUrl = trpc.files.generateUploadUrl.useMutation();
  const createFile = trpc.files.createFile.useMutation();

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      // Check if we're at the limit
      if (uploadedFiles.length + newFiles.length >= 5) {
        toast.error("Maximum 5 files allowed per message.");
        break;
      }

      try {
        // Generate upload URL
        const uploadUrl = await generateUploadUrl.mutateAsync();
        
        // Upload file to Convex
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        const { storageId } = await uploadResponse.json();

        // Create file record in database
        const fileRecord = await createFile.mutateAsync({
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
        });

        // Add to uploaded files
        newFiles.push({
          id: fileRecord,
          name: file.name,
          type: file.type,
          size: file.size,
          storageId,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newFiles.length > 0) {
      onFilesChange([...uploadedFiles, ...newFiles]);
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onFilesChange(uploadedFiles.filter(f => f.id !== fileId));
  };

  return (
    <div className={`bg-white/70 backdrop-blur-lg rounded-2xl border border-gray-200 shadow-2xl px-5 py-4 chatbox-stable ${className}`}>
      <form onSubmit={onSubmit}>
        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <PaperclipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(file.id)}
                  disabled={isLoading}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAttachClick}
              disabled={isLoading}
              className="h-8 px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-100 hover:border-gray-300 transition-colors"
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
    </div>
  );
} 