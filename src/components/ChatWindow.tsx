import React, { useState, useRef, useEffect } from "react";
import { CopyIcon, GitBranchIcon, RotateCcwIcon, EditIcon, SquareIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

import { useChatStore } from "../stores/chatStore";
import { useImageStore } from "../stores/imageStore";

import { CustomScrollbar } from './CustomScrollbar';
import { ActionButton } from './ActionButton';
import { UploadedFile } from './FileUpload';
import { Chatbox } from './Chatbox';
import { FileAttachmentWithUrl } from './FileAttachmentWithUrl';
import { GroundingSources } from './GroundingSources';
import { MessageImage } from './MessageImage';
import { ImageSkeleton } from './ImageSkeleton';
import { isImageGenerationModel } from '../utils/modelUtils';
import { ChunkedMarkdown } from './ChunkedMarkdown';
import { ApiKeyWarningBanner } from './ApiKeyWarningBanner';
import { WelcomeScreen } from './chat/WelcomeScreen';
import { MobileMenuButton } from './chat/MobileMenuButton';

// Hooks
import { useChatData } from '../hooks/useChatData';
import { useChatScrolling } from '../hooks/useChatScrolling';
import { useChatStreaming } from '../hooks/useChatStreaming';

// Utils
import { getDefaultModel, getProviderFromModel, createShakeAnimation, navigateToSettings, adjustTextareaHeight, smartFocus } from '../utils/chatHelpers';
import { filterOutEmptyOptimisticMessages, createOptimisticUserMessage, removeErrorMessages, mapFileAttachments } from '../utils/messageUtils';

// Types
import { ChatWindowProps, Message, FileAttachmentData } from '../types/chat';

// Constants
import { sharedLayoutClasses, sharedGridClasses, chatboxLayoutClasses, chatboxGridClasses } from '../constants/chatLayout';

const ChatWindowComponent = ({ threadId, onThreadCreate, selectedModel, onModelChange, sidebarCollapsed, sidebarWidth, onToggleSidebar, onOpenSearch, currentView, onNavigateToSettings }: ChatWindowProps) => {
  // Local state
  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldShakeBanner, setShouldShakeBanner] = useState(false);
  const [mobileActiveMessageId, setMobileActiveMessageId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const previousThreadId = useRef<string | null>(null);
  
  // Global stores
  const { 
    getMessages, 
    setMessages, 
    addMessage, 
    isLoading,
    setLoading,
    isStreaming,
  } = useChatStore();
  
  const { getImageState } = useImageStore();
  
  // Custom hooks
  const {
    serverMessages,
    refetchMessages,
    allModels,
    bestDefaultModel,
    threads,
    refetchThreads,
    hasAnyApiKeys,
    createThread,
    updateThreadMetadata,
    generateTitle,
    saveStreamedMessage,
    saveAssistantMessage,
    deleteMessagesFromPoint,
    createManyMessages,
    updateFileAssociations,
    duplicateFilesForThread,
    updateMessageFileAssociations,
    utils
  } = useChatData(threadId);

  const {
    messagesEndRef,
    messagesContainer,
    setMessagesContainer,
    scrollLocked,
    scrollToBottomPinned,
    handleGroundingSourcesToggle
  } = useChatScrolling();

  const { streamResponse, stopStream, isStreamingRef, lastStreamCompletedAt } = useChatStreaming();

  // Computed values
  const shouldShowBanner = hasAnyApiKeys === false && currentView !== 'settings';
  const localMessages = getMessages(threadId || '');
  
  // Helper functions
  const shakeAnimation = createShakeAnimation();
  const triggerShakeAnimation = () => shakeAnimation.trigger(setShouldShakeBanner);
  const handleNavigateToSettings = () => navigateToSettings(onNavigateToSettings);

  // Auto-focus input on component mount
  useEffect(() => {
    smartFocus(inputRef, { delay: 100, reason: 'component-mount' });
  }, []);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInput(value);
  };

  // Auto-resize textarea effect
  useEffect(() => {
    adjustTextareaHeight(inputRef);
  }, [input]);

  // Thread change effect
  useEffect(() => {
    if (threadId !== previousThreadId.current) {
      setIsInitialLoad(true);
      previousThreadId.current = threadId;
      
      if (messagesContainer && threadId) {
        messagesContainer.scrollTop = 0;
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
      
      smartFocus(inputRef, { delay: 200, reason: 'thread-change' });
    }
  }, [threadId, messagesContainer]);

  // Image loading effect
  useEffect(() => {
    if (!isLoading || !threadId) return;
    
    if (!isImageGenerationModel(selectedModel)) return;
    
    const currentMessages = getMessages(threadId);
    const streamingMessage = currentMessages.find(msg => msg.isOptimistic && msg.imageUrl && msg.imageUrl !== "GENERATING");
    
    if (streamingMessage?.imageUrl) {
      const { isLoaded } = getImageState(streamingMessage.imageUrl);
      if (isLoaded) {
        setLoading(null, false);
      }
    }
  }, [isLoading, threadId, selectedModel, getMessages, getImageState, setLoading]);

  // Server message sync effect
  useEffect(() => {
    if (isLoading || isStreamingRef.current || !threadId || !serverMessages) return;
    
    const timeSinceLastStream = Date.now() - lastStreamCompletedAt.current;
    if (timeSinceLastStream < 500) return;
    
    const currentMessages = getMessages(threadId);
    const hasOptimistic = currentMessages.some(msg => msg.isOptimistic);
    
    if (!hasOptimistic) {
      const serverMsgs: Message[] = serverMessages.map(msg => ({ 
        ...msg, 
        createdAt: new Date(msg._creationTime),
        isOptimistic: false,
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
          name: `File ${fileId}`,
          type: 'unknown',
          size: 0,
        })) : undefined,
        imageUrl: msg.imageUrl,
      }));
      
      const mergedMessages = serverMsgs.map(serverMsg => {
        const localMsg = currentMessages.find(local => local.id === serverMsg.id);
        if (localMsg && !localMsg.isOptimistic) {
          return {
            ...serverMsg,
            imageUrl: localMsg.imageUrl || serverMsg.imageUrl,
            groundingMetadata: localMsg.groundingMetadata || serverMsg.groundingMetadata,
          };
        }
        return serverMsg;
      });
      
      const hasChanged = JSON.stringify(currentMessages) !== JSON.stringify(mergedMessages);
      if (hasChanged) {
        setMessages(threadId, mergedMessages);
      }
      
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

  // Scrollbar width detection effect
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

  // Auto-scroll effect
  useEffect(() => {
    if (isInitialLoad || scrollLocked.current) return;
    if (messagesContainer && messagesContainer.style.overflow === 'hidden') return;
    
    if (localMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [localMessages, isInitialLoad, messagesContainer]);

  // Close mobile message actions when clicking outside
  useEffect(() => {
    if (!mobileActiveMessageId) return;
    
    const handler = (event: Event) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the entire action cluster
      if (
        target.closest('.message-actions-container') ||
        target.closest('[data-action-button]')
      ) return;
      
      setMobileActiveMessageId(null);
    };
    
    document.addEventListener('click', handler);
    document.addEventListener('touchstart', handler);
    
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [mobileActiveMessageId]);

  // Event handlers
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

  // Custom streaming function for retries that only saves assistant message
  const streamRetryResponse = async (
    threadId: string,
    content: string,
    selectedModel: string,
    files: FileAttachmentData[] = [],
    searchGroundingEnabled: boolean = true,
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    scrollToBottomPinned: () => void,
    saveAssistantMessage: any,
    updateFileAssociations: any,
    updateThreadMetadata: any,
    generateTitle: any,
    refetchThreads: any
  ) => {
    // Create a custom save function that only saves assistant message
    const customSaveStreamedMessage = {
      mutateAsync: async (params: any) => {
        // Only save the assistant message for retries
        const assistantResult = await saveAssistantMessage.mutateAsync({
          threadId: params.threadId,
          content: params.assistantContent,
          model: params.model,
          isGrounded: params.isGrounded,
          groundingSources: params.groundingSources,
          imageUrl: params.imageUrl,
          stoppedByUser: params.stoppedByUser,
        });

        // Return format expected by streamResponse
        return {
          userMessage: { id: null }, // No user message saved
          assistantMessage: assistantResult
        };
      }
    };

    // Call streamResponse with our custom save function
    await streamResponse(
      threadId,
      content,
      selectedModel,
      files,
      searchGroundingEnabled,
      inputRef,
      scrollToBottomPinned,
      customSaveStreamedMessage,
      updateFileAssociations,
      updateThreadMetadata,
      generateTitle,
      refetchThreads
    );
  };

  const handleRetryMessage = async (messageId: string, isUserMessage: boolean) => {
    if (!threadId) return;

    try {
      setLoading(threadId, true);
      
      smartFocus(inputRef, { delay: 50, reason: 'user-action' });
      
      const currentMessages = getMessages(threadId);
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      const targetMessage = currentMessages[messageIndex];
      if (!targetMessage) return; // Type guard
      
      // Delete messages from this point forward in the database (if not optimistic)
      if (!targetMessage.isOptimistic) {
        await deleteMessagesFromPoint.mutateAsync({
          threadId,
          fromMessageId: messageId,
        });
      }

      if (isUserMessage) {
        // For user message retry: remove this message and all after it, then regenerate
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
        
        const userMessage = currentMessages[messageIndex];
        if (userMessage) {
          // Add the user message back as an optimistic message
          const optimisticUserMessage = createOptimisticUserMessage(
            userMessage.content, 
            userMessage.attachments
          );
          addMessage(threadId, optimisticUserMessage);
          
          // For retry, use custom streaming that only saves assistant message
          await streamRetryResponse(
            threadId,
            userMessage.content,
            selectedModel,
            userMessage.attachments || [],
            searchGroundingEnabled,
            inputRef,
            scrollToBottomPinned,
            saveAssistantMessage,
            updateFileAssociations,
            updateThreadMetadata,
            generateTitle,
            refetchThreads
          );
        }
      } else {
        // For AI message retry: remove this message, keep user message, regenerate AI response
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
          
        const lastUserMessage = messagesToKeep.slice().reverse().find(msg => msg.role === "user");
        if (lastUserMessage) {
          await streamRetryResponse(
            threadId,
            lastUserMessage.content,
            selectedModel,
            lastUserMessage.attachments || [],
            searchGroundingEnabled,
            inputRef,
            scrollToBottomPinned,
            saveAssistantMessage,
            updateFileAssociations,
            updateThreadMetadata,
            generateTitle,
            refetchThreads
          );
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

  const handleMobileMessageTap = (messageId: string) => {
    setMobileActiveMessageId(prev => prev === messageId ? null : messageId);
  };

  const handleSaveEdit = async (messageId: string) => {
    try {
      if (!editingContent.trim() || !threadId) return;

      const currentMessages = getMessages(threadId);
      const originalMessage = currentMessages.find(msg => msg.id === messageId);
      if (!originalMessage) return;

      if (editingContent.trim() === originalMessage.content.trim()) {
        setEditingMessageId(null);
        setEditingContent("");
        return;
      }

      if (!originalMessage.isOptimistic) {
        await deleteMessagesFromPoint.mutateAsync({
          threadId,
          fromMessageId: originalMessage.id,
        });
      }

      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
      }

      if (threadId) {
        const optimisticUserMessage = createOptimisticUserMessage(editingContent.trim());
        addMessage(threadId, optimisticUserMessage);
        setLoading(threadId, true);
        
        smartFocus(inputRef, { delay: 50, reason: 'user-action' });
        
        await streamResponse(
          threadId,
          editingContent.trim(),
          selectedModel,
          [],
          searchGroundingEnabled,
          inputRef,
          scrollToBottomPinned,
          saveStreamedMessage,
          updateFileAssociations,
          updateThreadMetadata,
          generateTitle,
          refetchThreads
        );
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

  const handleBranchOff = async (messageId: string) => {
    if (!threadId) return;

    try {
      setLoading(threadId, true);
      
      smartFocus(inputRef, { delay: 50, reason: 'user-action' });
      
        const currentMessages = getMessages(threadId);
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      const originalThread = threads?.find(t => t.id === threadId);
      const originalTitle = originalThread?.title || "Chat";
      const branchTitle = `${originalTitle} (Branch)`;
      
      const result = await createThread.mutateAsync({
        title: branchTitle,
        branchedFromThreadId: threadId,
      });

      if (result && result.id) {
        const newThreadId = result.id;
        
        const messagesToCopy = currentMessages
          .slice(0, messageIndex + 1)
          .filter(msg => !msg.isOptimistic);
        
        if (messagesToCopy.length > 0) {
          // Step 1: Duplicate all files for the new thread
          const fileIdMap = await duplicateFilesForThread.mutateAsync({
            sourceThreadId: threadId,
            targetThreadId: newThreadId,
          });

          // Step 2: Create messages (without file associations initially)
          const createdMessageIds = await createManyMessages.mutateAsync({
            threadId: newThreadId,
            messages: messagesToCopy.map(msg => ({
              content: msg.content,
              role: msg.role,
              model: msg.model || undefined,
              // Don't include attachments/imageFileId yet - we'll update them separately
              // Copy grounding data
              isGrounded: msg.isGrounded || undefined,
              groundingSources: msg.groundingMetadata?.sources?.map(source => ({
                title: source.title,
                url: source.url,
                snippet: source.snippet || undefined,
                confidence: source.confidence || undefined,
              })) || undefined,
              // Copy image generation data (URLs only, file IDs updated separately)
              imageUrl: msg.imageUrl || undefined,
              imageData: msg.imageData || undefined,
              // Copy stopped by user flag
              stoppedByUser: msg.stoppedByUser || undefined,
            })),
          });

          // Step 3: Update message file associations with duplicated file IDs
          for (let i = 0; i < messagesToCopy.length; i++) {
            const originalMessage = messagesToCopy[i];
            const newMessageId = createdMessageIds[i];

            if (!originalMessage || !newMessageId) continue;

            // Update attachments if any
            const newAttachmentIds = originalMessage.attachments?.map(attachment => 
              fileIdMap[attachment.id]
            ).filter((id): id is string => Boolean(id));

            // Update image file ID if any
            let newImageFileId: string | undefined;
            if ((originalMessage as any).imageFileId) {
              newImageFileId = fileIdMap[(originalMessage as any).imageFileId];
            }

            // Update the message with new file associations
            if (newAttachmentIds?.length || newImageFileId) {
              await updateMessageFileAssociations.mutateAsync({
                messageId: newMessageId.toString(),
                attachments: newAttachmentIds?.length ? newAttachmentIds : undefined,
                imageFileId: newImageFileId,
              });
            }

            // Update file records with the new message ID
            if (newAttachmentIds?.length) {
              await updateFileAssociations.mutateAsync({
                fileIds: newAttachmentIds,
                messageId: newMessageId.toString(),
                threadId: newThreadId,
              });
            }

            if (newImageFileId) {
              await updateFileAssociations.mutateAsync({
                fileIds: [newImageFileId],
                messageId: newMessageId.toString(),
                threadId: newThreadId,
              });
            }
          }
        }
        
        onThreadCreate(newThreadId);
        await refetchMessages();
        utils.chat.getThreads.invalidate();
        
        toast.dismiss();
        toast.success("Conversation branched successfully with all attachments and images");
      }
    } catch (error) {
      console.error("Error branching conversation:", error);
      toast.dismiss();
      toast.error("Failed to branch conversation");
    } finally {
      setLoading(null, false);
    }
  };

  // Unified Message Render
  const renderMessage = (message: Message) => {
    const isMobile = window.innerWidth < 640;
    const showActions = !message.isOptimistic && !message.isError;
    const mobileActionsVisible = isMobile && mobileActiveMessageId === message.id;
       
    return (
      <div key={message.id} className="flex justify-start">
        <div className="w-full max-w-full min-w-0">
          <div className={`${message.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"} group`}>
            <div
              tabIndex={-1}
              className={`rounded-xl px-4 max-w-full overflow-hidden min-w-0 ${isMobile ? 'cursor-pointer' : 'sm:cursor-default'} ${
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
              onClick={() => isMobile && handleMobileMessageTap(message.id)}
              onTouchStart={isMobile ? (e) => { 
                e.stopPropagation(); 
                handleMobileMessageTap(message.id); 
              } : undefined}
            >
              {/* Editing */}
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
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 w-full">
                      <div className="flex flex-col gap-2 w-full max-w-2xl">
                        {message.attachments.map((file) => (
                          <div key={file.id} className="w-full">
                            <FileAttachmentWithUrl fileId={file.id} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {message.isError ? (
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      <div className="flex-1">
                        <ChunkedMarkdown 
                          content={message.content}
                          chunkSize={75}
                        />
                      </div>
                    </div>
                  ) : (
                    <ChunkedMarkdown 
                      content={message.content}
                      chunkSize={75}
                    />
                  )}
                  
                  {message.role === "assistant" && message.groundingMetadata && (
                    <GroundingSources
                      sources={message.groundingMetadata.sources}
                      messageId={message.id}
                      onToggle={handleGroundingSourcesToggle}
                    />
                  )}
                  
                  {message.role === "assistant" && message.imageUrl && (
                    <div className="mt-4">
                      <MessageImage imageUrl={message.imageUrl} />
                    </div>
                  )}
                  
                  {message.role === "assistant" && message.stoppedByUser && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <SquareIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="currentColor" />
                        <span className="text-sm text-amber-700 dark:text-amber-300">
                          Stopped by user
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Message actions */}
            <div className={`message-actions-container flex items-center gap-1 ${message.role === "user" ? "mt-3 mb-2" : "mt-2 mb-2"} ${
              !showActions 
                ? "opacity-0 pointer-events-none" 
                : isMobile 
                  ? (mobileActionsVisible ? "opacity-100" : "opacity-0 pointer-events-none")
                  : "opacity-0 group-hover:opacity-100"
            } transition-opacity`}>
              {message.role === "assistant" && (
                <div className="flex items-center gap-1 mr-1">
                  {isMobile ? (
                    <div className="model-name-container px-4">
                      <div className="model-name-scroll text-sm text-muted-foreground">
                        <span>{getProviderFromModel(message.model, allModels)}</span>
                        <span className="mx-1">•</span>
                        <span>{message.model}</span>
                      </div>
                      <div className="model-name-fade"></div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground px-4">
                      {getProviderFromModel(message.model, allModels)}
                      <span>•</span>
                      <span>{message.model}</span>
                    </div>
                  )}
                </div>
              )}
              
              {message.role === "user" ? (
                <>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRetryMessage(message.id, true)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditMessage(message.id)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <EditIcon className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyMessage(message.content)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <CopyIcon className="h-4 w-4" />
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyMessage(message.content)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <CopyIcon className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBranchOff(message.id)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <GitBranchIcon className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRetryMessage(message.id, false)}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    data-action-button
                  >
                    <RotateCcwIcon className="h-4 w-4" />
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

    if (hasAnyApiKeys === false) {
      triggerShakeAnimation();
      return;
    }

    const messageContent = input.trim();
    const messageFiles = mapFileAttachments(uploadedFiles);
    
    setInput("");
    setUploadedFiles([]);

    smartFocus(inputRef, { delay: 100, reason: 'form-submit' });

    try {
      if (!threadId) {
        // Create thread immediately with a proper placeholder title
        const placeholderTitle = messageContent.length > 60 
          ? `${messageContent.slice(0, 57)}...`
          : messageContent || (messageFiles.length > 0 ? `File: ${messageFiles[0]?.name}` : 'New Chat');
        
        const newThread = await createThread.mutateAsync({
          title: placeholderTitle,
          model: selectedModel,
        });
        
        setLoading(newThread.id, true);
        isStreamingRef.current = true;
        
        smartFocus(inputRef, { delay: 50, reason: 'form-submit' });

        const optimisticUserMessage = createOptimisticUserMessage(messageContent, messageFiles);
        addMessage(newThread.id, optimisticUserMessage);
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);
        
        // Make thread appear in sidebar immediately
        onThreadCreate(newThread.id);
        await refetchThreads();

        // Start title generation immediately in parallel (don't await)
        generateTitle.mutateAsync({
          threadId: newThread.id,
          firstMessage: messageContent,
        }).then((titleResult) => {
          if (titleResult.success) {
            // Refresh sidebar to show updated title
            refetchThreads();
          }
        }).catch((error) => {
          console.error("Failed to generate title:", error);
        });

        // Start AI response streaming (also in parallel)
        await streamResponse(
          newThread.id,
          messageContent,
          selectedModel,
          messageFiles,
          searchGroundingEnabled,
          inputRef,
          scrollToBottomPinned,
          saveStreamedMessage,
          updateFileAssociations,
          updateThreadMetadata,
          generateTitle,
          refetchThreads
        );
        
      } else {
        setLoading(threadId, true);
        
        smartFocus(inputRef, { delay: 50, reason: 'form-submit' });
        
        const currentMessages = getMessages(threadId);
        const messagesWithoutErrors = removeErrorMessages(currentMessages);
        if (messagesWithoutErrors.length !== currentMessages.length) {
          setMessages(threadId, messagesWithoutErrors);
        }
        
        const optimisticUserMessage = createOptimisticUserMessage(messageContent, messageFiles);
        addMessage(threadId, optimisticUserMessage);

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);

        await streamResponse(
          threadId,
          messageContent,
          selectedModel,
          messageFiles,
          searchGroundingEnabled,
          inputRef,
          scrollToBottomPinned,
          saveStreamedMessage,
          updateFileAssociations,
          updateThreadMetadata,
          generateTitle,
          refetchThreads
        );
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(null, false);
    }
  };

  // Show welcome screen when no thread is selected
  if (!threadId) {
    return (
      <WelcomeScreen
        sidebarCollapsed={sidebarCollapsed}
        sidebarWidth={sidebarWidth}
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
        shouldShowBanner={shouldShowBanner}
        shouldShakeBanner={shouldShakeBanner}
        onNavigateToSettings={handleNavigateToSettings}
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
        onSearchGroundingChange={setSearchGroundingEnabled}
                  onModelSelectorClick={triggerShakeAnimation}
                />
    );
  }

  // Main chat interface when threadId exists
  return (
    <div 
      className="fixed inset-0 flex flex-col bg-white dark:bg-slate-900 sm:left-auto mobile-no-refresh"
      style={{ 
        left: window.innerWidth >= 640 ? (sidebarCollapsed ? '0px' : `${sidebarWidth}px`) : '0px',
        transition: 'left 0.3s ease-out'
      }}
    >
      {/* API Key Warning Banner */}
      {shouldShowBanner && (
        <ApiKeyWarningBanner
          onNavigateToSettings={handleNavigateToSettings}
          isDismissible={false}
          shouldShake={shouldShakeBanner}
        />
      )}
      
      {/* Mobile Menu Button */}
      <MobileMenuButton 
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        onOpenSearch={onOpenSearch}
      />

      {/* Messages + Chatbox Area */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {/* Mobile: Native scrollbars */}
        <div 
ref={setMessagesContainer}
          className="block sm:hidden absolute inset-0 overflow-y-auto mobile-hidden-scrollbar"
          style={{ touchAction: 'pan-y' }}
        >
          <div className={`${sharedGridClasses} pt-8 pb-48`}>
            <div></div>
            <div className="w-full">
              <div className={sharedLayoutClasses} id="messages-container">
                <div className="space-y-0">
                  {filterOutEmptyOptimisticMessages(localMessages).map(renderMessage)}
            
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="w-full flex">
                        {isImageGenerationModel(selectedModel) ? (
                          <div className="w-full">
                            <div className="px-4">
                              <div className="mt-4">
                                <ImageSkeleton />
                              </div>
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  )}
            
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
            <div></div>
          </div>
        </div>
        
        {/* Desktop: Custom scrollbars */}
        <div className="hidden sm:block absolute inset-0">
        <CustomScrollbar 
            className="h-full"
          onRef={setMessagesContainer}
        >
          <div className={`${sharedGridClasses} pt-8 pb-48`}>
            <div></div>
            <div className="w-full">
              <div className={sharedLayoutClasses} id="messages-container">
                <div className="space-y-0">
                  {filterOutEmptyOptimisticMessages(localMessages).map(renderMessage)}
            
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="w-full flex">
                        {isImageGenerationModel(selectedModel) ? (
                          <div className="w-full">
                            <div className="px-4">
                              <div className="mt-4">
                                <ImageSkeleton />
                              </div>
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  )}
            
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
            <div></div>
          </div>
        </CustomScrollbar>
        </div>
        
      </div>
      
      {/* Chatbox - positioned relative to the main container, not the messages area */}
        <div className="absolute bottom-0 left-0 z-20 right-0 sm:left-0" style={{ right: window.innerWidth >= 640 ? `${scrollbarWidth}px` : '0px' }}>
          <div className="px-3 sm:hidden">
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
                isStreaming={isStreaming}
                onStop={stopStream}
                inputRef={inputRef}
                searchGroundingEnabled={searchGroundingEnabled}
                onSearchGroundingChange={setSearchGroundingEnabled}
                onModelSelectorClick={triggerShakeAnimation}
              />
            </div>
          </div>
          <div className={`hidden sm:block ${chatboxGridClasses}`}>
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
                  isStreaming={isStreaming}
                  onStop={stopStream}
                  inputRef={inputRef}
                  searchGroundingEnabled={searchGroundingEnabled}
                  onSearchGroundingChange={setSearchGroundingEnabled}
                  onModelSelectorClick={triggerShakeAnimation}
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize the component with custom comparison to prevent unnecessary re-renders
export const ChatWindow = React.memo(ChatWindowComponent, (prevProps, nextProps) => {
  const { isTransitioning } = useChatStore.getState();
  if (isTransitioning) {
    return true;
  }

  return (
    prevProps.threadId === nextProps.threadId &&
    prevProps.selectedModel === nextProps.selectedModel &&
    prevProps.sidebarCollapsed === nextProps.sidebarCollapsed &&
    prevProps.sidebarWidth === nextProps.sidebarWidth
  );
});