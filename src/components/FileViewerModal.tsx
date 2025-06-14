import React, { useState, useRef } from 'react';
import { X, Download, Trash2, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileAttachmentData } from './FileAttachment';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { createPortal } from 'react-dom';

// Configure PDF.js worker using CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileViewerModalProps {
  file: FileAttachmentData;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
  canDelete?: boolean;
}

export function FileViewerModal({ 
  file, 
  isOpen, 
  onClose, 
  onDelete, 
  canDelete = false 
}: FileViewerModalProps) {
  const [imageRotation, setImageRotation] = useState(0);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfPageWidth, setPdfPageWidth] = useState<number | null>(null);

  if (!isOpen) return null;

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

  const handleDelete = () => {
    if (onDelete && canDelete) {
      onDelete(file.id);
      onClose();
    }
  };

  const handleOpenInNewTab = () => {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  const isDocument = file.type.includes('document') || 
                   file.type.includes('spreadsheet') || 
                   file.type.includes('presentation') ||
                   file.type.includes('msword') ||
                   file.type.includes('excel') ||
                   file.type.includes('powerpoint');
  const isText = file.type.startsWith('text/') || 
                file.type === 'application/json' ||
                file.type === 'application/xml' ||
                file.name.endsWith('.md') ||
                file.name.endsWith('.txt') ||
                file.name.endsWith('.json') ||
                file.name.endsWith('.xml') ||
                file.name.endsWith('.csv');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRotate = () => setImageRotation(prev => (prev + 90) % 360);

  // Handle PDF document load success
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // For PDF: dynamically set modal width based on first page
  const handlePdfDocumentLoad = async (e: any) => {
    if (e && e.doc) {
      const pdf = e.doc;
      const firstPage = await pdf.getPage(1);
      // Get width at 100% scale (default is 1)
      const viewport = firstPage.getViewport({ scale: 1 });
      setPdfPageWidth(viewport.width);
    }
  };

  // Determine optimal modal dimensions based on content type
  const getModalDimensions = () => {
    if (isPDF) {
      return {
        width: pdfPageWidth ? undefined : 'w-[90vw] max-w-full', // fallback if not loaded
        height: 'max-h-[75vh]',
        minHeight: 'min-h-[60vh]'
      };
    }
    if (isText) {
      return {
        width: 'max-w-5xl',
        height: 'max-h-[95vh]',
        minHeight: 'min-h-[70vh]'
      };
    }
    if (isImage) {
      return {
        width: 'max-w-3xl',
        height: 'max-h-[90vh]',
        minHeight: 'min-h-[40vh]'
      };
    }
    if (isVideo) {
      return {
        width: 'max-w-4xl',
        height: 'max-h-[85vh]',
        minHeight: 'min-h-[50vh]'
      };
    }
    return {
      width: 'max-w-2xl',
      height: 'max-h-[70vh]',
      minHeight: 'min-h-[40vh]'
    };
  };

  // Determine content area height based on content type
  const getContentHeight = () => {
    const dimensions = getModalDimensions();
    if (isText || isPDF) {
      return 'calc(95vh - 80px)'; // Maximize height for text content and PDFs
    }
    if (isVideo) {
      return 'calc(85vh - 80px)';
    }
    if (isImage) {
      return 'calc(90vh - 80px)'; // Flexible for images
    }
    return 'calc(70vh - 80px)';
  };

  // Determine minimum content height based on content type
  const getContentMinHeight = () => {
    if (isText || isPDF) {
      return 'calc(70vh - 80px)'; // Ensure good reading experience for text and PDFs
    }
    if (isVideo) {
      return 'calc(50vh - 80px)';
    }
    if (isImage) {
      return 'calc(40vh - 80px)'; // Allow compact for wide images
    }
    return 'calc(40vh - 80px)'; // Compact for simple content
  };

  const renderFileContent = () => {
    if (!file.url) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground min-h-0">
          <div className="text-center">
            <p>File preview not available</p>
            <p className="text-sm mt-2">The file URL is not accessible</p>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg"
            style={{
              transform: `rotate(${imageRotation}deg)`,
              transformOrigin: 'center',
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          />
        </div>
      );
    }

    if (isPDF) {
      return (
        <div className="flex h-[70vh] w-full justify-center">
          <iframe
            src={file.url}
            title={file.name}
            className="h-full w-full rounded-md border border-border bg-background"
            style={{ display: 'block' }}
            allowFullScreen
          />
        </div>
      );
    }

    if (isDocument) {
      return (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <h3 className="font-medium text-foreground mb-2">{file.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {file.type} • {formatFileSize(file.size)}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleDownload} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={handleOpenInNewTab} variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isText) {
      return (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          <div className="flex-1 overflow-auto">
            <iframe
              src={file.url}
              className="w-full h-full border-0 rounded"
              title={file.name}
              style={{ minHeight: '400px' }}
            />
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          <video
            controls
            className="max-w-full max-h-full rounded"
            src={file.url}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎵</span>
              </div>
              <h3 className="font-medium text-foreground">{file.name}</h3>
            </div>
            <audio controls className="w-full max-w-md rounded">
              <source src={file.url} type={file.type} />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      );
    }

    // Fallback for unsupported file types
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground min-h-0">
        <div className="text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <p className="font-medium">Preview not available</p>
          <p className="text-sm mt-2">File type: {file.type}</p>
          <p className="text-sm">Size: {formatFileSize(file.size)}</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={handleDownload} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button onClick={handleOpenInNewTab} variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center z-[100] p-4 pointer-events-auto"
      onClick={handleBackdropClick}
    >
      {/* Modal */}
      <div 
        className={`relative rounded-3xl border border-border shadow-2xl dark:shadow-2xl dark:shadow-black/50 max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col transition-all duration-300 ease-out ${
          isOpen 
            ? 'scale-100 opacity-100 translate-y-0' 
            : 'scale-75 opacity-0 translate-y-8'
        }`}
        style={{ 
          backgroundColor: 'hsl(var(--card))', 
          ...(isPDF && pdfPageWidth ? { width: Math.min(pdfPageWidth, window.innerWidth * 0.95) } : {})
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 bg-card rounded-t-3xl">
          <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-semibold text-foreground truncate">
                {file.name}
              </h2>
              <p className="text-sm text-muted-foreground">
              {file.type} • {formatFileSize(file.size)}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 h-full flex flex-col rounded-b-3xl overflow-hidden p-2 bg-card">
          <div className="flex-1 h-full w-full flex flex-col overflow-hidden rounded-2xl bg-card">
            {renderFileContent()}
          </div>
        </div>
      </div>
    </div>,
    typeof window !== 'undefined' ? document.body : (null as any)
  );
} 