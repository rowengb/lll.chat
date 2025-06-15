import React, { useState, useRef, useEffect, useMemo } from "react";
import { ArrowUpIcon, CopyIcon, GitBranchIcon, RotateCcwIcon, EditIcon, Waves, PenToolIcon, CodeIcon, BrainIcon, LightbulbIcon, BarChartIcon, ChefHatIcon, ZapIcon, BotIcon, ShieldIcon, PaperclipIcon, XIcon, SearchIcon, PanelLeftIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ModelSelector, getProviderIcon } from "./ModelSelector";
import toast from "react-hot-toast";
import Logo from './Logo';
import { useChatStore } from "../stores/chatStore";
import { CustomScrollbar } from './CustomScrollbar';
import { ActionButton } from './ActionButton';
import { CodeBlock } from './CodeBlock';
import { FileUpload, UploadedFile } from './FileUpload';
import { FileAttachment, FileAttachmentData } from './FileAttachment';
import { Chatbox } from './Chatbox';
import { FileAttachmentWithUrl } from './FileAttachmentWithUrl';
import { GroundingSources } from './GroundingSources';
import { MessageImage } from './MessageImage';
import { ImageSkeleton } from './ImageSkeleton';

// Shared layout CSS for perfect alignment
const sharedLayoutClasses = "max-w-[80%] w-full mx-auto";
const sharedGridClasses = "grid grid-cols-[1fr_min(900px,100%)_1fr] px-6";

// Slightly wider chatbox for visual hierarchy
const chatboxLayoutClasses = "max-w-[800px] w-full mx-auto";
const chatboxGridClasses = "grid grid-cols-[1fr_min(800px,100%)_1fr] gap-4 px-4";

interface ChatWindowProps {
  threadId: string | null;
  onThreadCreate: (threadId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  onToggleSidebar?: () => void;
}

interface Message {
  id: string;
  content: string;
  role: string;
  model?: string | null;
  createdAt: Date;
  isOptimistic?: boolean;
  isError?: boolean;
  isGrounded?: boolean; // Indicates if response was grounded with Google Search
  groundingMetadata?: GroundingMetadata; // Google Search grounding metadata
  attachments?: FileAttachmentData[];
  imageFileId?: string; // Reference to generated image file in Convex storage
}

interface GroundingSource {
  title: string; // Domain name (e.g., "pbs.org", "democracynow.org")
  url: string; // Vertexaisearch redirect URL (e.g., "https://vertexaisearch.cloud.google.com/grounding-api-redirect/...")
  snippet?: string;
  confidence?: number; // Confidence percentage (0-100)
  // Unfurled metadata from the actual destination
  unfurled?: {
    title?: string; // Actual article title
    description?: string; // Article description
    image?: string; // Article image
    favicon?: string; // Site favicon
    siteName?: string; // Site name
    finalUrl?: string; // Final URL after redirects
  };
}

interface GroundingMetadata {
  sources?: GroundingSource[]; // The sources used for grounding (optional)
}

const ChatWindowComponent = ({ threadId, onThreadCreate, selectedModel, onModelChange, sidebarCollapsed, sidebarWidth, onToggleSidebar }: ChatWindowProps) => {
  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messagesContainer, setMessagesContainer] = useState<HTMLDivElement | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const previousThreadId = useRef<string | null>(null);
  const scrollLocked = useRef<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Use global chat store instead of local state
  const { 
    getMessages, 
    setMessages, 
    addMessage, 
    updateStreamingMessage, 
    isStreaming, 
    setStreaming,
    isLoading,
    setLoading,
    isTransitioning: globalIsTransitioning,
    startThreadTransition,
    endThreadTransition,
    getDisplayMessages
  } = useChatStore();
  
  // Simple approach: get messages directly and let smooth transitions handle the rest
  const localMessages = getMessages(threadId || '');
  
  // Ref to track streaming state and prevent race conditions
  const isStreamingRef = useRef(false);
  
  const { data: serverMessages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { threadId: threadId || "" },
    { 
      enabled: !!threadId && typeof threadId === "string",
      refetchOnWindowFocus: false,
      retry: false
    }
  );

  // Get models from database
  const { data: allModels } = trpc.models.getModels.useQuery();
  const { data: favoriteModels } = trpc.models.getFavoriteModels.useQuery();

  // Get best default model from user preferences
  const { data: bestDefaultModel } = trpc.userPreferences.getBestDefaultModel.useQuery();

  // Add threads query to trigger sidebar refresh when titles change
  const { data: threads, refetch: refetchThreads } = trpc.chat.getThreads.useQuery();
  const utils = trpc.useUtils();

  // T3.chat style: Show welcome elements dynamically based on input content
  const showWelcomeElements = !threadId && input.trim() === "";

  // Handle input changes - just update input, welcome visibility is reactive
  const handleInputChange = (value: string) => {
    setInput(value);
  };

  // Fast but smooth scroll from top to bottom on thread change
  useEffect(() => {
    if (threadId !== previousThreadId.current) {
      setIsInitialLoad(true);
      previousThreadId.current = threadId;
      
      if (messagesContainer && threadId) {
        // Start from top
        messagesContainer.scrollTop = 0;
        
        // Fast smooth animate to bottom
        requestAnimationFrame(() => {
          if (messagesContainer) {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
            setIsInitialLoad(false);
          }
        });
      }
    }
  }, [threadId, messagesContainer]);

  // Simple server message sync
  useEffect(() => {
    if (isLoading || isStreamingRef.current || !threadId || !serverMessages) return;
    
    const currentMessages = getMessages(threadId);
    const hasOptimistic = currentMessages.some(msg => msg.isOptimistic);
    
    if (!hasOptimistic) {
      const serverMsgs: Message[] = serverMessages.map(msg => ({ 
        ...msg, 
        createdAt: new Date(msg._creationTime),
        isOptimistic: false,
        // Map grounding data from server response
        isGrounded: msg.isGrounded,
        groundingMetadata: msg.isGrounded && msg.groundingSources ? {
          sources: msg.groundingSources?.map(source => ({
            title: source.title,
            url: source.url,
            snippet: source.snippet,
            confidence: source.confidence,
            unfurled: source.unfurledTitle ? {
              title: source.unfurledTitle,
              description: source.unfurledDescription,
              image: source.unfurledImage,
              favicon: source.unfurledFavicon,
              siteName: source.unfurledSiteName,
              finalUrl: source.unfurledFinalUrl,
            } : undefined,
          })),
        } : undefined,
        attachments: msg.attachments ? msg.attachments.map(fileId => ({
          id: fileId,
          name: `File ${fileId}`, // We'll need to fetch actual file names separately if needed
          type: 'unknown',
          size: 0,
        })) : undefined,
      }));
      
      setMessages(threadId, serverMsgs);
      
      // Fast smooth scroll to bottom after loading
      if (isInitialLoad && messagesContainer) {
        requestAnimationFrame(() => {
          if (messagesContainer) {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
            setIsInitialLoad(false);
          }
        });
      }
    }
  }, [serverMessages, threadId, isLoading, isInitialLoad, messagesContainer, setMessages, getMessages]);

  // Detect scrollbar width and compensate chatbox position
  useEffect(() => {
    const detectScrollbarWidth = () => {
      if (messagesContainer) {
        const element = messagesContainer;
        const hasScrollbar = element.scrollHeight > element.clientHeight;
        const currentScrollbarWidth = hasScrollbar ? (element.offsetWidth - element.clientWidth) : 0;
        setScrollbarWidth(currentScrollbarWidth);
      }
    };

    detectScrollbarWidth();
    
    // Watch for content changes that might affect scrollbar
    const observer = new ResizeObserver(detectScrollbarWidth);
    if (messagesContainer) {
      observer.observe(messagesContainer);
    }

    window.addEventListener('resize', detectScrollbarWidth);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', detectScrollbarWidth);
    };
  }, [localMessages, messagesContainer]);

  // Get default model using user preferences and API key availability
  const getDefaultModel = (): string => {
    // If we have the bestDefaultModel data, use it (even if null - means no API keys)
    if (bestDefaultModel) {
      // If there's a valid model ID, use it
      if (bestDefaultModel.modelId) {
        return bestDefaultModel.modelId;
      }
      // If modelId is null but we have the bestDefaultModel result, it means no API keys
      // Don't fallback to favorite models without API keys
      if (bestDefaultModel.reason === "no_api_keys") {
        return 'gpt-4o'; // Safe fallback - but user will get error about missing API key
      }
    }
    
    // If bestDefaultModel is still loading, use gpt-4o as fallback
    return 'gpt-4o'; // final fallback
  };

  const createThread = trpc.chat.createThread.useMutation({
    onSuccess: (newThread) => {
      onThreadCreate(newThread.id);
      
      // Set model to user's preferred default
      const defaultModel = getDefaultModel();
      onModelChange(defaultModel);
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
  });

  const updateThreadMetadata = trpc.chat.updateThreadMetadata.useMutation();
  const generateTitle = trpc.chat.generateTitle.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const saveStreamedMessage = trpc.chat.saveStreamedMessage.useMutation();
  const deleteMessage = trpc.chat.deleteMessage.useMutation();
  const deleteMessagesFromPoint = trpc.chat.deleteMessagesFromPoint.useMutation();
  const saveAssistantMessage = trpc.chat.saveAssistantMessage.useMutation();
  const createManyMessages = trpc.chat.createManyMessages.useMutation();
  const updateFileAssociations = trpc.files.updateFileAssociations.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handler for when grounding sources are toggled
  const handleGroundingSourcesToggle = (isExpanded: boolean, elementRef: HTMLDivElement | null) => {
    if (!elementRef || !messagesContainer) return;

    setTimeout(() => {
      const elementRect = elementRef.getBoundingClientRect();
      const containerRect = messagesContainer.getBoundingClientRect();
      
      // Get the chatbox height (more generous estimate) + margin
      const chatboxHeight = 160; // Increased from 120 to account for larger chatbox
      const bottomBuffer = 40; // Increased buffer space
      
      if (isExpanded) {
        // When expanding, scroll to ensure the expanded content isn't hidden by the chatbox
        const elementBottom = elementRect.bottom;
        const visibleBottom = containerRect.bottom - chatboxHeight - bottomBuffer;
        
        if (elementBottom > visibleBottom) {
          // Calculate how much we need to scroll down (more generous scrolling)
          const scrollAmount = elementBottom - visibleBottom + 60; // Extra 60px for comfort
          
          messagesContainer.scrollTo({
            top: messagesContainer.scrollTop + scrollAmount,
            behavior: 'smooth'
          });
        }
      } else {
        // When collapsing, scroll back down to show more of the message content
        // Check if the element is too high up in the viewport
        const elementTop = elementRect.top;
        const containerTop = containerRect.top;
        const topBuffer = 100; // Buffer from top of container
        
        if (elementTop < containerTop + topBuffer) {
          // Calculate how much to scroll back up to center the element better
          const scrollBackAmount = (containerTop + topBuffer) - elementTop + 40; // Extra space for comfort
          
          messagesContainer.scrollTo({
            top: messagesContainer.scrollTop - scrollBackAmount,
            behavior: 'smooth'
          });
        }
      }
    }, 100); // Small delay to ensure DOM has updated
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.dismiss();
      toast.success("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy message:", error);
              toast.dismiss();
        toast.error("Failed to copy message");
    }
  };

  const handleRetryMessage = async (messageId: string, isUserMessage: boolean) => {
    if (!threadId) return;

    try {
      setLoading(threadId, true);
      
      // Find the message index
      const currentMessages = getMessages(threadId);
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      if (isUserMessage) {
        // For user messages, remove all messages after this one and resend
        const messagesToKeep = currentMessages.slice(0, messageIndex + 1);
        setMessages(threadId, messagesToKeep);
        
        const userMessage = currentMessages[messageIndex];
        if (userMessage) {
          await streamResponse(threadId, userMessage.content, userMessage.attachments || []);
        }
      } else {
        // For assistant messages, remove this message and all after it, then resend the last user message
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
          
        // Find the last user message to resend
        const lastUserMessage = messagesToKeep.reverse().find(msg => msg.role === "user");
        if (lastUserMessage) {
          await streamResponse(threadId, lastUserMessage.content, lastUserMessage.attachments || []);
        }
      }
    } catch (error) {
      console.error("Error retrying message:", error);
      setLoading(null, false);
    }
  };

  const handleEditMessage = (messageId: string) => {
    const message = localMessages.find(msg => msg.id === messageId);
    if (message) {
      setEditingMessageId(messageId);
      setEditingContent(message.content);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    try {
      if (!editingContent.trim() || !threadId) return;

      // Find the original message
      const currentMessages = getMessages(threadId);
      const originalMessage = currentMessages.find(msg => msg.id === messageId);
      if (!originalMessage) return;

      // Check if the content has actually changed
      if (editingContent.trim() === originalMessage.content.trim()) {
        // No change, just cancel editing
        setEditingMessageId(null);
        setEditingContent("");
        return;
      }

      // Content has changed - delete original and everything after it from database
      if (!originalMessage.isOptimistic) {
        await deleteMessagesFromPoint.mutateAsync({
          threadId,
          fromMessageId: originalMessage.id,
        });
      }

      // Find the message index to remove from local state
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        // Remove all messages from the edited one forward in local state
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
      }

             // Create new user message with edited content and get AI response
       if (threadId) {
         // Add optimistic user message for the edited content
         const optimisticUserMessage: Message = {
           id: `temp-edit-${Date.now()}`,
           content: editingContent.trim(),
           role: "user",
           createdAt: new Date(),
           isOptimistic: true,
         };
         
         addMessage(threadId, optimisticUserMessage);
         setLoading(threadId, true);
         
         // Stream the AI response (this will save both user and assistant messages)
         await streamResponse(threadId, editingContent.trim());
      }

      setEditingMessageId(null);
      setEditingContent("");
              toast.dismiss();
      toast.success("Message edited and conversation updated");
    } catch (error) {
      console.error("Failed to save edit:", error);
              toast.dismiss();
        toast.error("Failed to save edit");
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };



  // Helper function to send a message programmatically and get AI response
  const sendMessageProgrammatically = async (content: string) => {
    if (!threadId) return;

    let optimisticUserMessage: Message | undefined;
    try {
      setLoading(threadId, true);
      addMessage(threadId, optimisticUserMessage = {
        id: `temp-user-${Date.now()}`,
        content,
      role: "user",
      createdAt: new Date(),
      isOptimistic: true,
      });

      // Stream the response
      await streamResponse(threadId, content);
    } catch (error) {
      console.error("Error sending message programmatically:", error);
      // Remove optimistic message on error
      if (optimisticUserMessage) {
        const currentMessages = getMessages(threadId);
        const filteredMessages = currentMessages.filter(msg => msg.id !== optimisticUserMessage!.id);
        setMessages(threadId, filteredMessages);
      }
      setLoading(null, false);
    }
  };

  // Helper function to send a message programmatically with a specific model
  const sendMessageProgrammaticallyWithModel = async (content: string, model: string) => {
    if (!threadId) return;

    let optimisticMessage: Message | undefined;
    try {
      setLoading(threadId, true);
      addMessage(threadId, optimisticMessage = {
        id: `temp-user-${Date.now()}`,
        content,
        role: "user",
        createdAt: new Date(),
        isOptimistic: true,
      });

      // Stream the response with the specified model
      await streamResponseWithModel(threadId, content, model);
    } catch (error) {
      console.error("Error sending message programmatically with model:", error);
      // Remove optimistic message on error
      if (optimisticMessage) {
        const currentMessages = getMessages(threadId);
        const filteredMessages = currentMessages.filter(msg => msg.id !== optimisticMessage!.id);
        setMessages(threadId, filteredMessages);
      }
      setLoading(null, false);
    }
  };

  const getProviderFromModel = (modelId?: string | null) => {
    if (!modelId || !allModels) return "openai";
    
    const modelData = allModels.find(m => m.id === modelId);
    return modelData?.provider || "openai";
  };

  // Helper function to detect if model is for image generation
  const isImageGenerationModel = (modelId?: string | null) => {
    if (!modelId || !allModels) {
      console.log(`🎨 [DEBUG] Image model check: modelId=${modelId}, allModels=${!!allModels}`);
      return false;
    }
    
    const modelData = allModels.find(m => m.id === modelId);
    console.log(`🎨 [DEBUG] Model data for ${modelId}:`, modelData);
    const hasImageCapability = modelData?.capabilities?.includes('image-generation') || false;
    console.log(`🎨 [DEBUG] Has image capability: ${hasImageCapability}`);
    return hasImageCapability;
  };

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 128; // max-h-32 = 128px
      const minHeight = 20; // Even slimmer default height
      
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  useEffect(() => {
    // Don't auto-scroll during initial load - we handle that in the server sync effect
    if (isInitialLoad || scrollLocked.current) return;
    
    // Don't auto-scroll if container overflow is hidden (during positioning)
    if (messagesContainer && messagesContainer.style.overflow === 'hidden') return;
    
    // Always scroll immediately when messages change (including during streaming)
    if (localMessages.length > 0) {
      // Use instant scroll for immediate response during streaming and user interactions
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [localMessages, isInitialLoad, messagesContainer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    const messageContent = input.trim();
    const messageFiles = uploadedFiles.map(file => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      url: file.url,
      storageId: file.storageId
    }));
    
    setInput("");
    setUploadedFiles([]);

    try {
      if (!threadId) {
        // Create thread and stream immediately - smooth T3.chat style flow
        console.log(`[SUBMIT] Creating new thread and streaming message: "${messageContent.slice(0, 30)}..."`);
        const defaultModel = getDefaultModel();
        const newThread = await createThread.mutateAsync({
          title: messageContent.slice(0, 50) || (messageFiles.length > 0 ? `File: ${messageFiles[0]?.name}` : 'New Chat'),
          model: defaultModel,
        });
        onModelChange(defaultModel);
        
        // Start streaming setup BEFORE URL change to prevent clearing messages
        setLoading(newThread.id, true);
        isStreamingRef.current = true; // Protect from useEffect clearing messages

        // Create optimistic user message FIRST
    const optimisticUserMessage: Message = {
          id: `temp-user-${Date.now()}`,
      content: messageContent,
      role: "user",
      createdAt: new Date(),
      isOptimistic: true,
          attachments: messageFiles.length > 0 ? messageFiles : undefined,
    };

        // Add optimistic user message BEFORE URL change
        addMessage(newThread.id, optimisticUserMessage);
        
        // Immediately scroll to bottom after adding user message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);
        
        // NOW change URL (after optimistic message is set)
        onThreadCreate(newThread.id);

        // Start streaming response on the new thread
        await streamResponse(newThread.id, messageContent, messageFiles);
        
        // Refresh sidebar to show the new thread
        await refetchThreads();
      } else {
        // We're already on a thread page - stream immediately
        setLoading(threadId, true);
        
        // Remove any error messages before adding new user message
        const currentMessages = getMessages(threadId);
        const messagesWithoutErrors = currentMessages.filter(msg => !msg.isError);
        if (messagesWithoutErrors.length !== currentMessages.length) {
          setMessages(threadId, messagesWithoutErrors);
        }
        
        // Create optimistic user message
        const optimisticUserMessage: Message = {
          id: `temp-user-${Date.now()}`,
          content: messageContent,
          role: "user",
          createdAt: new Date(),
          isOptimistic: true,
          attachments: messageFiles.length > 0 ? messageFiles : undefined,
        };

        // Add optimistic user message
        addMessage(threadId, optimisticUserMessage);

        // Immediately scroll to bottom after adding user message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);

      // Start streaming response
        await streamResponse(threadId, messageContent, messageFiles);
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(null, false);
    }
  };

  const streamResponse = async (threadId: string, content: string, files: FileAttachmentData[] = []) => {
    console.log(`[STREAM] Starting stream for thread: ${threadId}`);
    
    // Create optimistic assistant message for streaming
    const optimisticAssistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      content: "",
      role: "assistant",
      createdAt: new Date(),
      isOptimistic: true,
    };

    addMessage(threadId, optimisticAssistantMessage);
    
    // Immediately scroll to bottom after adding assistant message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }, 0);
    
    // Mark as streaming to prevent server sync interference
    isStreamingRef.current = true;
    setStreaming(threadId, true);

    try {
      // Get conversation history for streaming (exclude optimistic and error messages)
      const currentMessages = getMessages(threadId);
      const messages = currentMessages
        .filter(msg => !msg.isOptimistic && !msg.isError)
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      // Add the new user message
      messages.push({ role: "user", content });

      console.log(`[STREAM] Sending request with ${messages.length} messages`);

      // Create streaming request
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          model: selectedModel,
          threadId,
          files: files.length > 0 ? files : undefined,
          searchGrounding: searchGroundingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the streaming response (T3.chat style)
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let messageId = "";
      let isGrounded = false;
      let groundingMetadata: GroundingMetadata | undefined = undefined;
      let imageGenerated = false;
      let imageFileId = "";

      console.log(`[STREAM] Starting to read stream...`);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[STREAM] Stream completed`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            console.log(`[STREAM] Processing line: ${line.substring(0, 100)}...`);
            
            // Handle T3.chat format: f:metadata, 0:content, d:done
            if (line.startsWith('f:')) {
              // Metadata (message ID, grounding, etc.)
              try {
                const metadata = JSON.parse(line.slice(2));
                if (metadata.messageId) {
                  messageId = metadata.messageId;
                  console.log(`[STREAM] Got message ID: ${messageId}`);
                }
                if (metadata.grounding) {
                  isGrounded = true;
                  console.log(`🔍 [STREAM] Grounding metadata received:`, metadata.grounding);
                  
                  // Extract grounding metadata if present
                  const extractedSources: GroundingSource[] = [];
                  
                  if (metadata.grounding) {
                    console.log(`🔍 [STREAM] Raw grounding data:`, metadata.grounding);
                    
                    // Extract sources
                    if (metadata.grounding.sources) {
                      for (const source of metadata.grounding.sources) {
                        extractedSources.push({
                          title: source.title || 'Unknown Source',
                          url: source.url || '#',
                          snippet: source.snippet,
                          confidence: source.confidence,
                        });
                      }
                    }
                    
                    groundingMetadata = {
                      sources: extractedSources,
                    };
                    
                    console.log(`🔍 [STREAM] Processed grounding metadata:`, groundingMetadata);
                  }
                }
                if (metadata.imageGenerated) {
                  imageGenerated = true;
                  imageFileId = metadata.imageFileId || "";
                  console.log(`🎨 [STREAM] Image generated with file ID: ${imageFileId}`);
                }
                if (metadata.error) {
                  console.error(`[STREAM] API Error: ${metadata.error}`);
                  
                  // Replace the optimistic assistant message with an error message
                  const currentMessages = getMessages(threadId);
                  const updatedMessages = currentMessages.map(msg => {
                    if (msg.id === optimisticAssistantMessage.id) {
                      return {
                        ...msg,
                        content: `❌ **Error**: ${metadata.error}`,
                        isOptimistic: false,
                        isError: true
                      };
                    }
                    return msg;
                  });
                  setMessages(threadId, updatedMessages);
                  
                  // Clear loading and streaming states
                  setLoading(null, false);
                  setStreaming(null, false);
                  isStreamingRef.current = false;
                  return; // Exit the stream processing
                }
              } catch (e) {
                console.error('[STREAM] Failed to parse metadata:', e);
              }
            } else if (line.startsWith('0:')) {
              // Content chunk
              try {
                const contentChunk = JSON.parse(line.slice(2));
                fullContent += contentChunk;
                
                console.log(`[STREAM] Content chunk: "${contentChunk}" (total: ${fullContent.length} chars)`);
                
                // Hide loading animation on first content chunk (TTFB complete)
                if (fullContent.length > 0) {
                  setLoading(null, false);
                }
                
                // Update the streaming message immediately
                updateStreamingMessage(threadId, optimisticAssistantMessage.id, fullContent);
              } catch (e) {
                console.error('[STREAM] Failed to parse content chunk:', e);
              }
            } else if (line.startsWith('d:')) {
              // Done signal
              try {
                const doneData = JSON.parse(line.slice(2));
                console.log(`[STREAM] Stream done, final content length: ${fullContent.length}, server reported: ${doneData.length || 'unknown'}`);
                
                // Stream complete - save to DB and clean up
                const savedMessages = await saveStreamedMessage.mutateAsync({
                  threadId,
                  userContent: content,
                  assistantContent: fullContent,
                  model: selectedModel,
                  userAttachments: files.map(file => file.id),
                  isGrounded,
                  groundingSources: groundingMetadata?.sources && groundingMetadata.sources.length > 0 ? groundingMetadata.sources : undefined,
                  imageFileId: imageGenerated ? imageFileId : undefined,
                });

                // Update file associations if there are files
                if (files.length > 0 && savedMessages.userMessage.id) {
                  await updateFileAssociations.mutateAsync({
                    fileIds: files.map(file => file.id),
                    messageId: savedMessages.userMessage.id,
                    threadId,
                  });
                }

                // Update thread metadata
                if (threadId) {
                  await updateThreadMetadata.mutateAsync({
                    threadId,
                    lastModel: selectedModel,
                  });
                }

                // Generate title for new conversations
                const currentMessages = getMessages(threadId);
                const isFirstMessage = currentMessages.filter(msg => !msg.isOptimistic && msg.role === "user").length === 0;
                if (isFirstMessage) {
                  try {
                    const titleResult = await generateTitle.mutateAsync({
                      threadId,
                      firstMessage: content,
                    });
                    if (titleResult.success) {
                      await refetchThreads();
                    }
                  } catch (error) {
                    console.error("Failed to generate title:", error);
                  }
                }
                
                // Mark both user and assistant messages as non-optimistic and clean up other optimistic messages
                const allMessages = getMessages(threadId);
                const updatedMessages = allMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    // Mark assistant message as complete with model info, grounding status, and sources
                    return { 
                      ...msg, 
                      isOptimistic: false, 
                      content: fullContent, 
                      model: selectedModel, 
                      isGrounded,
                      groundingMetadata: groundingMetadata,
                      imageFileId: imageGenerated ? imageFileId : undefined
                    };
                  } else if (msg.role === "user" && msg.isOptimistic) {
                    // Mark user message as non-optimistic too
                    return { ...msg, isOptimistic: false };
                  }
                  return msg;
                }).filter(msg => !msg.isOptimistic);
                setMessages(threadId, updatedMessages);
                isStreamingRef.current = false; // Clear streaming flag
                setStreaming(null, false);
                setLoading(null, false);
                return;
              } catch (e) {
                console.error('[STREAM] Failed to parse done signal:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error("[STREAM] Streaming error:", error);
      
      // Replace optimistic assistant message with error message instead of removing it
      const currentMessages = getMessages(threadId);
      const updatedMessages = currentMessages.map(msg => {
        if (msg.id === optimisticAssistantMessage.id) {
          return {
            ...msg,
            content: `❌ **Error**: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
            isOptimistic: false,
            isError: true
          };
        }
        return msg;
      });
      setMessages(threadId, updatedMessages);
      
      isStreamingRef.current = false; // Clear streaming flag on error
      setStreaming(null, false);
      setLoading(null, false); // Clear loading on error
      
      // Don't throw the error - we've handled it by showing it in the chat
    }
  };

  const streamResponseWithModel = async (threadId: string, content: string, model: string, files: FileAttachmentData[] = []) => {
    // Create optimistic assistant message for streaming
    const optimisticAssistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      content: "",
      role: "assistant",
      createdAt: new Date(),
      isOptimistic: true,
    };

    addMessage(threadId, optimisticAssistantMessage);
    
    // Mark as streaming to prevent server sync interference
    isStreamingRef.current = true;
    setStreaming(threadId, true);

    try {
      // Get conversation history for streaming (exclude optimistic and error messages)
      const currentMessages = getMessages(threadId);
      const messages = currentMessages
        .filter(msg => !msg.isOptimistic && !msg.isError) // Don't include optimistic or error messages
        .map(msg => ({ role: msg.role, content: msg.content }));

      // Create streaming request
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          model: model, // Use the specified model instead of selectedModel
          files: files.length > 0 ? files : undefined,
          searchGrounding: searchGroundingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                // Stream complete - save to DB
                
                // For retry, only save the assistant message (user message already exists)
                await saveAssistantMessage.mutateAsync({
                  threadId,
                  content: fullContent,
                  model: model, // Use the specified model
                });

                // Update thread metadata with the retry model
                if (threadId) {
                  await updateThreadMetadata.mutateAsync({
                    threadId,
                    lastModel: model,
                    // TODO: Add cost and token calculation here
                  });
                }
                
                // Mark the assistant message as non-optimistic and clean up other optimistic messages (model already set)
                const allMessages = getMessages(threadId);
                const updatedMessages = allMessages.map(msg => 
                  msg.id === optimisticAssistantMessage.id 
                    ? { ...msg, isOptimistic: false, content: fullContent, model: model }
                    : msg
                ).filter(msg => !msg.isOptimistic);
                setMessages(threadId, updatedMessages);
                isStreamingRef.current = false; // Clear streaming flag
                setStreaming(null, false);
                setLoading(null, false);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  
                  // Hide loading animation on first content chunk (TTFB complete)
                  if (fullContent.length > 0) {
                    setLoading(null, false);
                  }
                  
                  // Update the streaming message immediately for real-time feel
                  updateStreamingMessage(threadId, optimisticAssistantMessage.id, fullContent);
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error("Streaming error:", error);
      // Remove optimistic assistant message on error
      const currentMessages = getMessages(threadId);
      const filteredMessages = currentMessages.filter(msg => msg.id !== optimisticAssistantMessage.id);
      setMessages(threadId, filteredMessages);
      isStreamingRef.current = false; // Clear streaming flag on error
      setStreaming(null, false);
      setLoading(null, false); // Clear loading on error
      throw error;
    }
  };

  const handleBranchOff = async (messageId: string) => {
    if (!threadId) return;

    try {
      setLoading(threadId, true);
      
      // Find the message index
      const currentMessages = getMessages(threadId);
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      // Get the original thread title for better branch naming
      const originalThread = threads?.find(t => t.id === threadId);
      const originalTitle = originalThread?.title || "Chat";
      const branchTitle = `${originalTitle} (Branch)`;
      
      // Create new thread with messages up to this point
      const result = await createThread.mutateAsync({
        title: branchTitle,
        branchedFromThreadId: threadId,
      });

      if (result && result.id) {
        const newThreadId = result.id;
        
        // Copy messages up to and including the branch point (excluding optimistic messages)
        const messagesToCopy = currentMessages
          .slice(0, messageIndex + 1)
          .filter(msg => !msg.isOptimistic);
        
        // Save copied messages to database if there are any
        if (messagesToCopy.length > 0) {
          await createManyMessages.mutateAsync({
            threadId: newThreadId,
            messages: messagesToCopy.map(msg => ({
              content: msg.content,
              role: msg.role,
              model: msg.model || undefined,
            })),
          });
        }
        
        // Navigate to new thread (messages will be loaded from server)
        onThreadCreate(newThreadId);
        
        // Refresh the messages query for the new thread to ensure immediate sync
        await refetchMessages();
        
        // Invalidate threads cache to immediately update sidebar
        utils.chat.getThreads.invalidate();
        
        toast.dismiss();
        toast.success("Conversation branched successfully");
      }
    } catch (error) {
      console.error("Error branching conversation:", error);
      toast.dismiss();
      toast.error("Failed to branch conversation");
    } finally {
      setLoading(null, false);
    }
  };

  // Show welcome screen when no thread is selected
  if (!threadId) {
    const examplePrompts = [
      {
        title: "Creative Writing",
        prompt: "Help me write a short story about a time traveler who accidentally changes a small detail in the past",
        icon: PenToolIcon
      },
      {
        title: "Code Review",
        prompt: "Review this Python function and suggest improvements for performance and readability",
        icon: CodeIcon
      },
      {
        title: "Learn Something New",
        prompt: "Explain quantum computing in simple terms with practical examples",
        icon: BrainIcon
      },
      {
        title: "Problem Solving",
        prompt: "Help me brainstorm solutions for reducing plastic waste in my daily life",
        icon: LightbulbIcon
      },
      {
        title: "Data Analysis",
        prompt: "How can I analyze customer feedback data to identify key improvement areas?",
        icon: BarChartIcon
      },
      {
        title: "Recipe Ideas",
        prompt: "Suggest a healthy dinner recipe using chicken, vegetables, and ingredients I likely have at home",
        icon: ChefHatIcon
      }
    ];

    const handleExampleClick = (prompt: string) => {
      setInput(prompt);
      inputRef.current?.focus();
    };

    return (
      <div 
        className="fixed top-0 right-0 bottom-0 flex flex-col bg-white dark:bg-slate-900 left-0 sm:left-auto"
        style={{ 
          left: window.innerWidth >= 640 ? (sidebarCollapsed ? '0px' : `${sidebarWidth}px`) : '0px',
          transition: 'left 0.3s ease-out'
        }}
      >
        {/* Mobile Menu Button - Only show when sidebar is collapsed */}
        <div className={`sm:hidden fixed z-50 ${sidebarCollapsed ? 'block' : 'hidden'}`}>
          <div 
            className="absolute"
            style={{
              top: '24px',
              left: '0px'
            }}
          >
            <div 
              className="bg-muted border border-border" 
              style={{ 
                borderRadius: '0 20px 20px 0',
                padding: '4px'
              }}
            >
              <div className="flex flex-col gap-1">
                <Button
                  onClick={() => {/* TODO: Add search functionality */}}
                  size="sm"
                  variant="ghost"
                  title="Search"
                  className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
                >
                  <SearchIcon className="h-4 w-4" />
                </Button>
                <Button
                  onClick={onToggleSidebar}
                  size="sm"
                  variant="ghost"
                  title="Expand Sidebar"
                  className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
                >
                  <PanelLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => {
                    // Handle new chat - navigate to home/welcome
                    window.location.href = '/';
                  }}
                  size="sm"
                  variant="ghost"
                  title="New Chat"
                  className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
                >
                  <PlusIcon className="h-4.25 w-4.25" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Content Area with proper scrolling container for chatbox alignment */}
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-y-auto">
            <div className={`${sharedGridClasses} min-h-full flex items-center justify-center pb-32`}>
              <div></div>
              <div className="w-full">
                <div className={sharedLayoutClasses}>
                  {/* Welcome elements that hide/show based on input - T3.chat style */}
                  <div className={`text-center transition-all duration-300 ${showWelcomeElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-light text-foreground mb-4">
                Welcome to <span className="font-bold">lll</span><span className="font-normal">.chat</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Start a conversation with AI. Choose from the examples below or type your own message.
              </p>
            </div>

            {/* Example Prompts Carousel */}
            <div className="mb-8">
              {/* Desktop: Grid layout */}
              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {examplePrompts.map((example, index) => {
                  const IconComponent = example.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example.prompt)}
                      className="group text-left p-4 bg-gradient-to-br from-card/80 to-muted/60 dark:from-slate-800/80 dark:to-slate-700/60 backdrop-blur-sm hover:from-muted/90 hover:to-muted/70 dark:hover:from-slate-700/90 dark:hover:to-slate-600/70 rounded-2xl border border-border/60 hover:border-border/80 shadow-lg shadow-muted/20 hover:shadow-xl hover:shadow-muted/30 transition-all duration-300 hover:-translate-y-1 backdrop-saturate-150"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
                            {example.title}
                          </h3>
                          <p className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-3 transition-colors">
                            {example.prompt}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Mobile: Horizontal scrolling carousel */}
              <div className="md:hidden relative">
                <div className="overflow-x-auto scrollbar-hide w-screen relative" style={{ left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
                  <div className="flex gap-3 pb-2 pl-4 pr-4" style={{ width: 'max-content' }}>
                    {examplePrompts.map((example, index) => {
                      const IconComponent = example.icon;
                      return (
                        <button
                          key={index}
                          onClick={() => handleExampleClick(example.prompt)}
                          className="group text-left p-4 bg-gradient-to-br from-card/80 to-muted/60 dark:from-slate-800/80 dark:to-slate-700/60 backdrop-blur-sm hover:from-muted/90 hover:to-muted/70 dark:hover:from-slate-700/90 dark:hover:to-slate-600/70 rounded-2xl border border-border/60 hover:border-border/80 shadow-lg shadow-muted/20 hover:shadow-xl hover:shadow-muted/30 transition-all duration-300 hover:-translate-y-1 backdrop-saturate-150"
                          style={{ width: '240px', flexShrink: 0 }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
                                {example.title}
                              </h3>
                              <p className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-3 transition-colors">
                                {example.prompt}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Left fade gradient */}
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-slate-900 to-transparent pointer-events-none z-10" style={{ left: '50%', marginLeft: '-50vw' }}></div>
                
                {/* Right fade gradient */}
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none z-10" style={{ right: '50%', marginRight: '-50vw' }}></div>
              </div>
            </div>

            {/* Features highlight */}
            <div className="bg-gradient-to-r from-card/90 to-muted/80 dark:from-slate-800/90 dark:to-slate-700/80 backdrop-blur-sm rounded-2xl border border-border/70 p-6 max-w-2xl mx-auto shadow-lg shadow-muted/20 backdrop-saturate-150">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="flex justify-center mb-2">
                    <ZapIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground">Lightning Fast</div>
                  <div className="text-xs text-muted-foreground">Real-time streaming</div>
                </div>
                <div>
                  <div className="flex justify-center mb-2">
                    <BotIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground">Multiple Models</div>
                  <div className="text-xs text-muted-foreground">GPT, Claude, Gemini & more</div>
                </div>  
                <div>
                  <div className="flex justify-center mb-2">
                    <ShieldIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground">BYOK & Privacy</div>
                  <div className="text-xs text-muted-foreground">Your keys, your data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
                    </div>
              <div></div>
                  </div>
          </div>
          
          {/* Chatbox - Using shared component */}
          <div className="absolute bottom-6 left-0 z-20 right-0 sm:left-0 sm:right-0">
            <div className="px-4 sm:hidden">
              {/* Mobile: Center middle chatbox */}
              <div className="max-w-[95%] w-full mx-auto">
                <Chatbox
                  input={input}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmit}
                  uploadedFiles={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                  isLoading={isLoading}
                  inputRef={inputRef}
                  searchGroundingEnabled={searchGroundingEnabled}
                  onSearchGroundingChange={(enabled) => setSearchGroundingEnabled(enabled)}
                />
              </div>
            </div>
            <div className={`hidden sm:block ${chatboxGridClasses}`}>
              {/* Desktop: Original layout */}
              <div></div>
              <div className="w-full">
                <div className={chatboxLayoutClasses}>
                  <Chatbox
                    input={input}
                    onInputChange={handleInputChange}
                    onSubmit={handleSubmit}
                    uploadedFiles={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                      selectedModel={selectedModel}
                      onModelChange={onModelChange}
                    isLoading={isLoading}
                    inputRef={inputRef}
                    searchGroundingEnabled={searchGroundingEnabled}
                    onSearchGroundingChange={(enabled) => setSearchGroundingEnabled(enabled)}
                    />
                    </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

        return (
    <div 
              className="fixed top-0 right-0 bottom-0 flex flex-col bg-white dark:bg-slate-900 left-0 sm:left-auto"
      style={{ 
        left: window.innerWidth >= 640 ? (sidebarCollapsed ? '0px' : `${sidebarWidth}px`) : '0px',
        transition: 'left 0.3s ease-out'
      }}
    >
      {/* Mobile Menu Button - Only show when sidebar is collapsed */}
      <div className={`sm:hidden fixed z-50 ${sidebarCollapsed ? 'block' : 'hidden'}`}>
        <div 
          className="absolute"
          style={{
            top: '24px',
            left: '0px'
          }}
        >
          <div 
            className="bg-muted border border-border" 
            style={{ 
              borderRadius: '0 20px 20px 0',
              padding: '4px'
            }}
          >
            <div className="flex flex-col gap-1">
              <Button
                onClick={() => {/* TODO: Add search functionality */}}
                size="sm"
                variant="ghost"
                title="Search"
                className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={onToggleSidebar}
                size="sm"
                variant="ghost"
                title="Expand Sidebar"
                className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
              >
                <PanelLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  // Handle new chat - navigate to home/welcome
                  window.location.href = '/';
                }}
                size="sm"
                variant="ghost"
                title="New Chat"
                className="h-8 w-8 p-0 hover:bg-card rounded-full transition-colors"
              >
                <PlusIcon className="h-4.25 w-4.25" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages + Chatbox Area */}
      <div className="flex-1 overflow-hidden relative">
        <CustomScrollbar 
          className={`h-full ${scrollLocked.current ? 'scroll-locked' : ''}`}
          onRef={setMessagesContainer}
        >
          <div className={`${sharedGridClasses} pt-8 pb-48`}>
            <div></div>
            <div className="w-full">
              <div className={sharedLayoutClasses} id="messages-container">
                <div className="space-y-0">
            {localMessages?.filter(message => 
              // Filter out empty optimistic assistant messages
              !(message.isOptimistic && message.role === "assistant" && !message.content.trim())
            ).map((message: Message) => (
                    <div key={message.id} className="flex justify-start">
                      <div className="w-full max-w-full min-w-0">
                        <div className={`${message.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"} group`}>
                    <div
                            className={`rounded-xl px-4 max-w-full overflow-hidden min-w-0 ${
                        message.role === "user"
                                ? "py-2" 
                                : "pt-1 pb-1"
                            } ${
                              message.role === "user"
                                ? "bg-primary/10 text-foreground border border-primary shadow-sm backdrop-blur-sm dark:bg-primary/30 dark:border-primary/50"
                                : message.isError
                                ? "bg-destructive/10 text-destructive border border-destructive/30 shadow-sm"
                                : "text-foreground"
                      }`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full p-2 border border-border rounded-lg text-sm resize-none bg-background text-foreground"
                            rows={Math.max(2, editingContent.split('\n').length)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleSaveEdit(message.id)}
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              Save
                            </Button>
                            <Button
                              onClick={handleCancelEdit}
                              size="sm"
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : message.role === "user" ? (
                              <div>
                        <p className="whitespace-pre-wrap text-sm leading-loose">
                          {message.content}
                        </p>
                                {/* Display file attachments for user messages */}
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2 inline-block">
                                    <div className="grid grid-cols-2 gap-2 max-w-md">
                                      {message.attachments.map((file) => (
                                        <div key={file.id}>
                                          <FileAttachmentWithUrl fileId={file.id} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                      ) : (
                              <div className="prose prose-sm w-full min-w-0 overflow-hidden text-foreground text-sm leading-loose">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              // Customize link styling
                              a: ({ node, ...props }) => (
                                <a 
                                  {...props} 
                                  className="text-primary hover:text-primary/80 underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                              // Customize code block styling
                              code: ({ node, className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match;
                                
                                return isInline ? (
                                  <code 
                                          className="text-gray-100 px-2 py-1 rounded text-xs font-mono" 
                                    style={{ backgroundColor: '#0C1117' }}
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                      ) : null; // Block code will be handled by pre
                              },
                                    // Style pre blocks with copy functionality
                                    pre: ({ node, children, ...props }) => {
                                      // Extract language from the code element
                                      const codeElement = children as any;
                                      const className = codeElement?.props?.className || '';
                                      const match = /language-(\w+)/.exec(className);
                                      const language = match ? match[1] : undefined;
                                      
                                      // If no language detected, it might be a plain pre block
                                      if (!language && !className) {
                                        return (
                                          <pre 
                                            className="text-gray-100 p-4 rounded-xl overflow-x-auto dark-scrollbar text-xs font-mono w-full min-w-0 my-3" 
                                            style={{ backgroundColor: '#0C1117' }}
                                            {...props}
                                          >
                                            {children}
                                          </pre>
                                        );
                                      }
                                      
                                      return (
                                        <CodeBlock 
                                          className={className}
                                          language={language}
                                        >
                                          {codeElement?.props?.children || children}
                                        </CodeBlock>
                                      );
                                    },
                              // Style lists
                              ul: ({ node, ...props }) => (
                                <ul 
                                  className="list-disc list-outside space-y-1 my-2 ml-4 pl-2"
                                  {...props}
                                />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol 
                                  className="list-decimal list-outside space-y-1 my-2 ml-4 pl-2"
                                  {...props}
                                />
                              ),
                              li: ({ node, ...props }) => (
                                <li 
                                  className="text-sm leading-loose"
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                                
                                {/* Show grounding sources for assistant messages */}
                                {message.role === "assistant" && message.groundingMetadata && (
                                  <GroundingSources
                                    sources={message.groundingMetadata.sources}
                                    messageId={message.id}
                                    onToggle={handleGroundingSourcesToggle}
                                  />
                                )}
                                
                                {/* Show generated images for assistant messages */}
                                {message.role === "assistant" && message.imageFileId && (
                                  <div className="mt-4">
                                    <MessageImage fileId={message.imageFileId} />
                                  </div>
                                )}
                        </div>
                      )}
                    </div>

                          {/* Message Actions - Always render to prevent layout shift, but hide for error messages */}
                          <div className={`flex items-center gap-1 ${message.role === "user" ? "mt-3 mb-2" : "mt-2 mb-2"} ${message.isOptimistic || message.isError ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                        {message.role === "assistant" && (
                              <div className="flex items-center gap-1 mr-1">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground px-5">
                              {getProviderFromModel(message.model)}
                              <span>•</span>
                              <span>{message.model}</span>
                            </div>
                          </div>
                        )}
                        
                            {message.role === "user" ? (
                              // User message actions: retry, edit, copy
                              <>
                                <ActionButton
                          variant="ghost"
                          size="sm"
                                  onClick={() => handleRetryMessage(message.id, message.role === "user")}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                                  <RotateCcwIcon className="h-4 w-4" />
                                </ActionButton>
                        
                                <ActionButton
                          variant="ghost"
                          size="sm"
                                  onClick={() => handleEditMessage(message.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                                  <EditIcon className="h-4 w-4" />
                                </ActionButton>
                        
                                <ActionButton
                          variant="ghost"
                          size="sm"
                                  onClick={() => handleCopyMessage(message.content)}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                >
                                  <CopyIcon className="h-4 w-4" />
                                </ActionButton>
                              </>
                            ) : (
                              // AI message actions: copy, branch off, retry
                              <>
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyMessage(message.content)}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                                  <CopyIcon className="h-4 w-4" />
                                </ActionButton>
                        
                                <ActionButton
                          variant="ghost"
                          size="sm"
                                  onClick={() => handleBranchOff(message.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                >
                                  <GitBranchIcon className="h-4 w-4" />
                                </ActionButton>
                                
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetryMessage(message.id, message.role === "user")}
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                        >
                                  <RotateCcwIcon className="h-4 w-4" />
                                </ActionButton>
                              </>
                    )}
                          </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              (() => {
                const isImageModel = isImageGenerationModel(selectedModel);
                console.log(`🎨 [DEBUG] Loading state: isLoading=${isLoading}, selectedModel=${selectedModel}, isImageModel=${isImageModel}`);
                return isImageModel ? (
                  <ImageSkeleton />
                ) : (
                  <div className="flex justify-start">
                    <div className="w-full flex">
                      <div className="max-w-full rounded-2xl bg-muted px-5 py-3 shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground"></div>
                            <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground animation-delay-100"></div>
                            <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground animation-delay-200"></div>
                          </div>
                          <span className="text-sm text-muted-foreground animate-pulse">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
            <div></div>
                  </div>
        </CustomScrollbar>
        
        {/* Chatbox - Using shared component */}
        <div className="absolute bottom-6 left-0 z-20 right-0 sm:left-0" style={{ right: window.innerWidth >= 640 ? `${scrollbarWidth}px` : '0px' }}>
          <div className="px-4 sm:hidden">
            {/* Mobile: Center middle chatbox */}
            <div className="max-w-[95%] w-full mx-auto">
              <Chatbox
                input={input}
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
                uploadedFiles={uploadedFiles}
                onFilesChange={setUploadedFiles}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                isLoading={isLoading}
                inputRef={inputRef}
                searchGroundingEnabled={searchGroundingEnabled}
                onSearchGroundingChange={(enabled) => setSearchGroundingEnabled(enabled)}
              />
            </div>
          </div>
          <div className={`hidden sm:block ${chatboxGridClasses}`}>
            {/* Desktop: Original layout */}
            <div></div>
            <div className="w-full">
              <div className={chatboxLayoutClasses}>
                <Chatbox
                  input={input}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmit}
                  uploadedFiles={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                  isLoading={isLoading}
                  inputRef={inputRef}
                  searchGroundingEnabled={searchGroundingEnabled}
                  onSearchGroundingChange={(enabled) => setSearchGroundingEnabled(enabled)}
                  />
                  </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize the component with custom comparison to prevent unnecessary re-renders
export const ChatWindow = React.memo(ChatWindowComponent, (prevProps, nextProps) => {
// During transitions, prevent re-renders by returning true (props are "equal")
const { isTransitioning } = useChatStore.getState();
if (isTransitioning) {
  return true; // Prevent re-render during transitions
}

// Normal comparison for other cases
return (
  prevProps.threadId === nextProps.threadId &&
  prevProps.selectedModel === nextProps.selectedModel &&
  prevProps.sidebarCollapsed === nextProps.sidebarCollapsed &&
  prevProps.sidebarWidth === nextProps.sidebarWidth
);
});