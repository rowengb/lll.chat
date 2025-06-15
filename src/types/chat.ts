export interface ChatWindowProps {
  threadId: string | null;
  onThreadCreate: (threadId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  onToggleSidebar?: () => void;
  currentView?: string;
  onNavigateToSettings?: () => void;
}

export interface Message {
  id: string;
  content: string;
  role: string;
  model?: string | null;
  createdAt: Date;
  isOptimistic?: boolean;
  isError?: boolean;
  isGrounded?: boolean;
  groundingMetadata?: GroundingMetadata;
  attachments?: FileAttachmentData[];
  imageUrl?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
  confidence?: number;
  unfurled?: {
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    finalUrl?: string;
  };
}

export interface GroundingMetadata {
  sources?: GroundingSource[];
}

export interface FileAttachmentData {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  storageId?: string;
} 