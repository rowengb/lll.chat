import React, { useState, useRef, useEffect } from "react";
import { CopyIcon, GitBranchIcon, RotateCcwIcon, EditIcon } from "lucide-react";
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
import { getDefaultModel, getProviderFromModel, createShakeAnimation, navigateToSettings, adjustTextareaHeight } from '../utils/chatHelpers';
import { filterOutEmptyOptimisticMessages, createOptimisticUserMessage, removeErrorMessages, mapFileAttachments } from '../utils/messageUtils';

// Types
import { ChatWindowProps, Message } from '../types/chat';

// Constants
import { sharedLayoutClasses, sharedGridClasses, chatboxLayoutClasses, chatboxGridClasses } from '../constants/chatLayout';

const ChatWindowComponent = ({ threadId, onThreadCreate, selectedModel, onModelChange, sidebarCollapsed, sidebarWidth, onToggleSidebar, currentView, onNavigateToSettings }: ChatWindowProps) => {
  // Local state
  const [input, setInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [searchGroundingEnabled, setSearchGroundingEnabled] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldShakeBanner, setShouldShakeBanner] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const previousThreadId = useRef<string | null>(null);

  // Global stores
  const { 
    getMessages, 
    setMessages, 
    addMessage, 
    isLoading,
    setLoading,
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
    deleteMessagesFromPoint,
    createManyMessages,
    updateFileAssociations,
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

  const { streamResponse, isStreamingRef, lastStreamCompletedAt } = useChatStreaming();

  // Computed values
  const shouldShowBanner = hasAnyApiKeys === false && currentView !== 'settings';
  const localMessages = getMessages(threadId || '');

  // Helper functions
  const shakeAnimation = createShakeAnimation();
  const triggerShakeAnimation = () => shakeAnimation.trigger(setShouldShakeBanner);
  const handleNavigateToSettings = () => navigateToSettings(onNavigateToSettings);

  // Auto-focus input on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
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
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
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

  const handleRetryMessage = async (messageId: string, isUserMessage: boolean) => {
    if (!threadId) return;

    try {
      setLoading(threadId, true);
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      
      const currentMessages = getMessages(threadId);
      const messageIndex = currentMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      if (isUserMessage) {
        const messagesToKeep = currentMessages.slice(0, messageIndex + 1);
        setMessages(threadId, messagesToKeep);
        
        const userMessage = currentMessages[messageIndex];
        if (userMessage) {
          await streamResponse(
            threadId,
            userMessage.content,
            selectedModel,
            userMessage.attachments || [],
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
      } else {
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
          
        const lastUserMessage = messagesToKeep.reverse().find(msg => msg.role === "user");
        if (lastUserMessage) {
          await streamResponse(
            threadId,
            lastUserMessage.content,
            selectedModel,
            lastUserMessage.attachments || [],
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
        
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
        
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
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      
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
          await createManyMessages.mutateAsync({
            threadId: newThreadId,
            messages: messagesToCopy.map(msg => ({
              content: msg.content,
              role: msg.role,
              model: msg.model || undefined,
            })),
          });
        }
        
        onThreadCreate(newThreadId);
        await refetchMessages();
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

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    try {
      if (!threadId) {
        const defaultModel = getDefaultModel(bestDefaultModel);
        const newThread = await createThread.mutateAsync({
          title: messageContent.slice(0, 50) || (messageFiles.length > 0 ? `File: ${messageFiles[0]?.name}` : 'New Chat'),
          model: defaultModel,
        });
        onModelChange(defaultModel);
        
        setLoading(newThread.id, true);
        isStreamingRef.current = true;
        
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);

        const optimisticUserMessage = createOptimisticUserMessage(messageContent, messageFiles);
        addMessage(newThread.id, optimisticUserMessage);
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
        }, 0);
        
        onThreadCreate(newThread.id);

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
        
        await refetchThreads();
      } else {
        setLoading(threadId, true);
        
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
        
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
      className="fixed top-0 right-0 bottom-0 flex flex-col bg-white dark:bg-slate-900 left-0 sm:left-auto"
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
      />

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
                  {filterOutEmptyOptimisticMessages(localMessages).map((message: Message) => (
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
                              <div>
                                <ChunkedMarkdown 
                                  content={message.content}
                                  chunkSize={75}
                                />
                                
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
                              </div>
                            )}
                          </div>

                          {/* Message Actions */}
                          <div className={`flex items-center gap-1 ${message.role === "user" ? "mt-3 mb-2" : "mt-2 mb-2"} ${message.isOptimistic || message.isError ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                            {message.role === "assistant" && (
                              <div className="flex items-center gap-1 mr-1">
                                <div className="flex items-center gap-1 text-sm text-muted-foreground px-5">
                                  {getProviderFromModel(message.model, allModels)}
                                  <span>•</span>
                                  <span>{message.model}</span>
                                </div>
                              </div>
                            )}
                            
                            {message.role === "user" ? (
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
        
        {/* Chatbox */}
        <div className="absolute bottom-6 left-0 z-20 right-0 sm:left-0" style={{ right: window.innerWidth >= 640 ? `${scrollbarWidth}px` : '0px' }}>
          <div className="px-4 sm:hidden">
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