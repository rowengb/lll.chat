import { useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { Message, FileAttachmentData, GroundingMetadata, GroundingSource } from "../types/chat";
import { isImageGenerationModel } from "../utils/modelUtils";
import { createOptimisticAssistantMessage, prepareMessagesForStreaming } from "../utils/messageUtils";
import { smartFocus } from "../utils/chatHelpers";

export const useChatStreaming = () => {
  const {
    getMessages,
    setMessages,
    addMessage,
    updateStreamingMessage,
    setStreaming,
    setLoading
  } = useChatStore();
  
  // Ref to track streaming state and prevent race conditions
  const isStreamingRef = useRef(false);
  const lastStreamCompletedAt = useRef<number>(0);
  
  // AbortController for stopping streams
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamDataRef = useRef<{
    threadId: string;
    optimisticAssistantMessage: any;
    fullContent: string;
    messageId: string;
    isGrounded: boolean;
    groundingMetadata: any;
    imageGenerated: boolean;
    imageUrl: string;
    selectedModel: string;
    content: string;
    files: any[];
    saveStreamedMessage: any;
    updateFileAssociations: any;
  } | null>(null);

  const stopStream = async () => {
    console.log('[STREAM] Stop requested by user');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Save partial response if we have stream data
    if (currentStreamDataRef.current) {
      const streamData = currentStreamDataRef.current;
      
      try {
        // Save the partial response to database
        await streamData.saveStreamedMessage.mutateAsync({
          threadId: streamData.threadId,
          userContent: streamData.content,
          assistantContent: streamData.fullContent,
          model: streamData.selectedModel,
          userAttachments: streamData.files.map(file => file.id),
          isGrounded: streamData.isGrounded,
          groundingSources: streamData.groundingMetadata?.sources && streamData.groundingMetadata.sources.length > 0 ? streamData.groundingMetadata.sources : undefined,
          imageUrl: streamData.imageGenerated ? streamData.imageUrl : undefined,
          stoppedByUser: true, // Flag to indicate this was stopped by user
        });

        // Update file associations if there are files
        if (streamData.files.length > 0) {
          await streamData.updateFileAssociations.mutateAsync({
            fileIds: streamData.files.map(file => file.id),
            messageId: streamData.messageId,
            threadId: streamData.threadId,
          });
        }

        // Mark the assistant message as complete but stopped
        const currentMessages = getMessages(streamData.threadId);
        const updatedMessages = currentMessages.map(msg => {
          if (msg.id === streamData.optimisticAssistantMessage.id) {
            return { 
              ...msg, 
              isOptimistic: false, 
              content: streamData.fullContent,
              model: streamData.selectedModel, 
              isGrounded: streamData.isGrounded,
              groundingMetadata: streamData.groundingMetadata,
              imageUrl: streamData.imageGenerated ? streamData.imageUrl : undefined,
              stoppedByUser: true, // Flag for UI display
            };
          } else if (msg.role === "user" && msg.isOptimistic) {
            return { ...msg, isOptimistic: false };
          }
          return msg;
        }).filter(msg => !msg.isOptimistic);
        
        setMessages(streamData.threadId, updatedMessages);
        
        console.log('[STREAM] Partial response saved after user stop');
      } catch (error) {
        console.error('[STREAM] Failed to save partial response:', error);
      }
    }
    
    // Clean up streaming state
    isStreamingRef.current = false;
    setStreaming(null, false);
    setLoading(null, false);
    abortControllerRef.current = null;
    currentStreamDataRef.current = null;
  };

  const streamResponse = async (
    threadId: string,
    content: string,
    selectedModel: string,
    files: FileAttachmentData[] = [],
    searchGroundingEnabled: boolean = true,
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    scrollToBottomPinned: () => void,
    saveStreamedMessage: any,
    updateFileAssociations: any,
    updateThreadMetadata: any,
    generateTitle: any,
    refetchThreads: any
  ) => {
    console.log(`[STREAM] Starting stream for thread: ${threadId}`);
    
    // Create optimistic assistant message for streaming
    const optimisticAssistantMessage = createOptimisticAssistantMessage();
    
    console.log(`🎨 [STREAM] Created optimistic message for model ${selectedModel}, isImageGen: ${isImageGenerationModel(selectedModel)}`);

    addMessage(threadId, optimisticAssistantMessage);
    
    // Immediately scroll to bottom after adding assistant message
    setTimeout(() => {
      scrollToBottomPinned();
      // Also focus input so user can start typing next message while AI responds
      smartFocus(inputRef, { reason: 'stream-start' });
    }, 0);
    
    // Mark as streaming to prevent server sync interference
    isStreamingRef.current = true;
    setStreaming(threadId, true);
    
    // Create AbortController for this stream
    abortControllerRef.current = new AbortController();

    try {
      // Get conversation history for streaming (exclude optimistic and error messages)
      const currentMessages = getMessages(threadId);
      const messages = prepareMessagesForStreaming(currentMessages);
      
      // Add the new user message
      messages.push({ role: "user", content });

      console.log(`[STREAM] Sending request with ${messages.length} messages`);

      // Store current stream data for potential stopping
      currentStreamDataRef.current = {
        threadId,
        optimisticAssistantMessage,
        fullContent: "",
        messageId: "",
        isGrounded: false,
        groundingMetadata: undefined,
        imageGenerated: false,
        imageUrl: "",
        selectedModel,
        content,
        files,
        saveStreamedMessage,
        updateFileAssociations,
      };

      // Create streaming request with abort signal
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
        signal: abortControllerRef.current.signal,
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
      let imageUrl = "";

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
                  // Update stream data
                  if (currentStreamDataRef.current) {
                    currentStreamDataRef.current.messageId = messageId;
                  }
                  
                  // Clear loading state as soon as we get messageId (streaming has started)
                  setLoading(null, false);
                  console.log(`[STREAM] Cleared loading state - streaming started`);
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
                    
                    // Update stream data
                    if (currentStreamDataRef.current) {
                      currentStreamDataRef.current.isGrounded = isGrounded;
                      currentStreamDataRef.current.groundingMetadata = groundingMetadata;
                    }
                    
                    // Auto-scroll to bottom when grounding sources are added
                    setTimeout(() => {
                      scrollToBottomPinned();
                    }, 100); // Slight delay to ensure grounding sources are rendered
                  }
                }
                if (metadata.imageGenerated) {
                  imageGenerated = true;
                  imageUrl = metadata.imageUrl || "";
                  console.log(`🎨 [STREAM] Image generated: ${imageUrl}`);
                  
                  // Update stream data
                  if (currentStreamDataRef.current) {
                    currentStreamDataRef.current.imageGenerated = imageGenerated;
                    currentStreamDataRef.current.imageUrl = imageUrl;
                  }
                  
                  // Update the streaming message with the image URL immediately
                  updateStreamingMessage(threadId, optimisticAssistantMessage.id, { imageUrl });
                  
                  // Auto-scroll to bottom when image is generated to keep it visible
                  setTimeout(() => {
                    scrollToBottomPinned();
                  }, 100); // Slight delay to ensure image element is rendered
                  
                  // Don't clear loading state yet - wait for image to actually load
                  // The loading state will be cleared when the image loads in MessageImage component
                  console.log(`🎨 [STREAM] Image URL received, keeping loading state until image loads`);
                }
                if (metadata.error) {
                  console.error(`[STREAM] API Error: ${metadata.error}`);
                  
                  // Replace the optimistic assistant message with an error message
                  const currentMessages = getMessages(threadId);
                  const updatedMessages = currentMessages.map(msg => {
                    if (msg.id === optimisticAssistantMessage.id) {
                      return {
                        ...msg,
                        content: `**Error**: ${metadata.error}`,
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
                
                // Update stream data with latest content
                if (currentStreamDataRef.current) {
                  currentStreamDataRef.current.fullContent = fullContent;
                }
                
                // Loading state is already cleared when messageId is received (streaming started)
                // No need to clear it again on first content chunk
                
                // Update the streaming message immediately
                updateStreamingMessage(threadId, optimisticAssistantMessage.id, { content: fullContent });
                
                // Auto-scroll to bottom during streaming to keep the live text visible (immediate)
                scrollToBottomPinned();
                
                // Keep input focused during streaming so user can immediately type next message
                // Only focus if not already focused to avoid interrupting user typing
                if (document.activeElement !== inputRef.current) {
                  smartFocus(inputRef, { reason: 'stream-content' });
                }
              } catch (e) {
                console.error('[STREAM] Failed to parse content chunk:', e);
              }
            } else if (line.startsWith('d:')) {
              // Done signal
              try {
                const doneData = JSON.parse(line.slice(2));
                console.log(`[STREAM] Stream done, final content length: ${fullContent.length}, server reported: ${doneData.length || 'unknown'}`);
                
                // For image generation, use the message from the done signal if no content was accumulated
                const finalContent = imageGenerated && !fullContent ? (doneData.message || "") : fullContent;
                
                // Stream complete - save to DB and clean up
                const savedMessages = await saveStreamedMessage.mutateAsync({
                  threadId,
                  userContent: content,
                  assistantContent: finalContent,
                  model: selectedModel,
                  userAttachments: files.map(file => file.id),
                  isGrounded,
                  groundingSources: groundingMetadata?.sources && groundingMetadata.sources.length > 0 ? groundingMetadata.sources : undefined,
                  imageUrl: imageGenerated ? imageUrl : undefined,
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
                
                // Mark both user and assistant messages as non-optimistic and clean up other optimistic messages
                const allMessages = getMessages(threadId);
                const updatedMessages = allMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    // Mark assistant message as complete with model info, grounding status, and sources
                    return { 
                      ...msg, 
                      isOptimistic: false, 
                      content: finalContent, 
                      model: selectedModel, 
                      isGrounded,
                      groundingMetadata: groundingMetadata,
                      imageUrl: imageGenerated ? imageUrl : undefined
                    };
                  } else if (msg.role === "user" && msg.isOptimistic) {
                    // Mark user message as non-optimistic too
                    return { ...msg, isOptimistic: false };
                  }
                  return msg;
                }).filter(msg => !msg.isOptimistic);
                setMessages(threadId, updatedMessages);
                isStreamingRef.current = false; // Clear streaming flag
                lastStreamCompletedAt.current = Date.now(); // Track when streaming completed
                setStreaming(null, false);
                setLoading(null, false);
                
                // Auto-focus input after streaming completes so user can immediately type next message
                smartFocus(inputRef, { delay: 200, reason: 'stream-complete' });
                
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
      // Handle abort specifically (user stopped the stream)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[STREAM] Stream aborted by user');
        // Don't show error message for user-initiated stops
        // The stopStream function handles saving partial response
        return;
      }
      
      console.error("[STREAM] Streaming error:", error);
      
      // Replace optimistic assistant message with error message instead of removing it
      const currentMessages = getMessages(threadId);
      const updatedMessages = currentMessages.map(msg => {
        if (msg.id === optimisticAssistantMessage.id) {
          return {
            ...msg,
            content: `**Error**: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
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
      
      // Auto-focus input after error so user can immediately type next message
      smartFocus(inputRef, { delay: 200, reason: 'stream-error' });
      
      // Don't throw the error - we've handled it by showing it in the chat
    } finally {
      // Clean up references on completion or error
      abortControllerRef.current = null;
      currentStreamDataRef.current = null;
    }
  };

  return {
    streamResponse,
    stopStream,
    isStreamingRef,
    lastStreamCompletedAt
  };
}; 