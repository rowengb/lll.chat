import { useRef, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { Message, FileAttachmentData, GroundingMetadata, GroundingSource } from "../types/chat";
import { isImageGenerationModel } from "../utils/modelUtils";
import { createOptimisticAssistantMessage, prepareMessagesForStreaming } from "../utils/messageUtils";
import { smartFocus } from "../utils/chatHelpers";
import { performanceMonitor, debounce } from "../utils/performanceOptimizations";

// Utility function to sanitize error data for database storage
const sanitizeErrorForStorage = (error: any): any => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Preserve any custom properties that might exist
      ...(error as any).rawErrorData && { rawErrorData: (error as any).rawErrorData }
    };
  }
  return error;
};

export const useChatStreaming = () => {
  const {
    getMessages,
    setMessages,
    addMessage,
    updateStreamingMessage,
    setStreaming,
    setLoading
  } = useChatStore();
  
  // Refs to track streaming state and prevent race conditions
  const isStreamingRef = useRef(false);
  const lastStreamCompletedAt = useRef<number>(0);
  const streamingStatsRef = useRef({
    totalChunks: 0,
    totalBytes: 0,
    firstChunkTime: 0,
    lastChunkTime: 0,
    averageChunkSize: 0
  });
  
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

  // Intelligent content buffering for smooth rendering
  const contentBufferRef = useRef<{
    buffer: string;
    lastFlush: number;
    flushTimer: NodeJS.Timeout | null;
  }>({
    buffer: '',
    lastFlush: 0,
    flushTimer: null
  });

  // Optimized content flushing with intelligent batching
  const flushContentBuffer = useCallback((threadId: string, messageId: string, force: boolean = false) => {
    const now = performance.now();
    const { buffer, lastFlush } = contentBufferRef.current;
    
    // Intelligent flushing: force flush every 50ms or when buffer is large
    const shouldFlush = force || 
                       (now - lastFlush > 50) || 
                       (buffer.length > 100);
    
    if (shouldFlush && buffer) {
      performanceMonitor.mark(`flush-${messageId}-start`);
      
      // Update UI with batched content
      updateStreamingMessage(threadId, messageId, { content: buffer });
      
      // Clear buffer
      contentBufferRef.current.buffer = '';
      contentBufferRef.current.lastFlush = now;
      
      performanceMonitor.mark(`flush-${messageId}-end`);
      performanceMonitor.measure(`flush-${messageId}`, `flush-${messageId}-start`, `flush-${messageId}-end`);
      
      // Clear any pending flush timer
      if (contentBufferRef.current.flushTimer) {
        clearTimeout(contentBufferRef.current.flushTimer);
        contentBufferRef.current.flushTimer = null;
      }
    }
  }, [updateStreamingMessage]);

  // Debounced scroll function to prevent excessive scrolling
  const debouncedScroll = useCallback(
    debounce((scrollFn: () => void) => {
      scrollFn();
    }, 16), // 60fps max scroll rate
    []
  );

  const stopStream = async () => {
    console.log('[STREAM] Stop requested by user');
    performanceMonitor.mark('stream-stop-start');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Flush any remaining content
    if (currentStreamDataRef.current) {
      const streamData = currentStreamDataRef.current;
      flushContentBuffer(streamData.threadId, streamData.optimisticAssistantMessage.id, true);
    }
    
    // Save partial response if we have stream data
    if (currentStreamDataRef.current) {
      const streamData = currentStreamDataRef.current;
      
      try {
        // Save the partial response to database
        await streamData.saveStreamedMessage.mutateAsync({
          threadId: streamData.threadId,
          userContent: streamData.content,
          assistantContent: contentBufferRef.current.buffer || streamData.fullContent,
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
              content: contentBufferRef.current.buffer || streamData.fullContent,
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
    
    // Reset content buffer
    contentBufferRef.current = {
      buffer: '',
      lastFlush: 0,
      flushTimer: null
    };
    
    performanceMonitor.mark('stream-stop-end');
    performanceMonitor.measure('stream-stop', 'stream-stop-start', 'stream-stop-end');
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
    refetchThreads: any,
    saveErrorMessage?: any
  ) => {
    const streamStartTime = performance.now();
    performanceMonitor.mark(`stream-${threadId}-start`);
    console.log(`[STREAM] Starting stream for thread: ${threadId} with model: ${selectedModel}`);
    
    // Reset streaming stats
    streamingStatsRef.current = {
      totalChunks: 0,
      totalBytes: 0,
      firstChunkTime: 0,
      lastChunkTime: 0,
      averageChunkSize: 0
    };
    
    // Reset content buffer
    contentBufferRef.current = {
      buffer: '',
      lastFlush: 0,
      flushTimer: null
    };
    
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
        let errorData: any = { status: response.status, statusText: response.statusText };
        try {
          const errorText = await response.text();
          if (errorText) {
            errorData = { ...errorData, response: JSON.parse(errorText) };
          }
        } catch (e) {
          // Keep basic error data if parsing fails
        }
        
        const error = new Error(`HTTP error! status: ${response.status}`);
        (error as any).rawErrorData = errorData;
        throw error;
      }

      // Read the streaming response with optimized processing
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
      let lineBuffer = ""; // Buffer for incomplete lines

      console.log(`[STREAM] Starting to read stream...`);
      const streamReadStart = performance.now();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[STREAM] Stream completed in ${(performance.now() - streamReadStart).toFixed(2)}ms`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          
          // Buffer incomplete lines to handle chunks split in middle of JSON
          lineBuffer += chunk;
          const allLines = lineBuffer.split('\n');
          
          // Keep the last line in buffer (might be incomplete)
          lineBuffer = allLines.pop() || "";
          
          // Process complete lines only
          const lines = allLines.filter(line => line.trim());

          // Update streaming stats
          streamingStatsRef.current.totalBytes += chunk.length;
          streamingStatsRef.current.totalChunks += lines.length;
          streamingStatsRef.current.lastChunkTime = performance.now();

          for (const line of lines) {
            // Handle T3.chat format: f:metadata, 0:content, d:done
            if (line.startsWith('f:')) {
              // Metadata (message ID, grounding, etc.)
              try {
                const jsonStr = line.slice(2);
                
                // Basic check for complete JSON - should start with { and end with }
                if (!jsonStr.trim().startsWith('{') || !jsonStr.trim().endsWith('}')) {
                  throw new Error(`Incomplete JSON metadata line: ${jsonStr}`);
                }
                
                const metadata = JSON.parse(jsonStr);
                if (metadata.messageId) {
                  messageId = metadata.messageId;
                  console.log(`[STREAM] Got message ID: ${messageId}`);
                  // Update stream data
                  if (currentStreamDataRef.current) {
                    currentStreamDataRef.current.messageId = messageId;
                  }
                  
                  console.log(`[STREAM] Got message ID - waiting for first content chunk to clear loading`);
                }
                if (metadata.grounding) {
                  isGrounded = true;
                  groundingMetadata = metadata.grounding;
                  console.log(`🔍 [STREAM] Grounding metadata received with ${groundingMetadata?.sources?.length || 0} sources`);
                    
                    // Update stream data
                    if (currentStreamDataRef.current) {
                      currentStreamDataRef.current.isGrounded = isGrounded;
                      currentStreamDataRef.current.groundingMetadata = groundingMetadata;
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
                  debouncedScroll(() => scrollToBottomPinned());
                  
                  console.log(`🎨 [STREAM] Image URL received, keeping loading state until image loads`);
                }
                if (metadata.error) {
                  console.error(`[STREAM] API Error: ${metadata.error}`);
                  
                  const errorContent = `**Error**: ${metadata.error}`;
                  
                  // Save error message to database if saveErrorMessage is available
                  if (saveErrorMessage) {
                    try {
                      await saveErrorMessage.mutateAsync({
                        threadId,
                        content: errorContent,
                        rawErrorData: metadata
                      });
                      console.log('[STREAM] Error message saved to database');
                    } catch (error) {
                      console.error('[STREAM] Failed to save error message:', error);
                    }
                  }
                  
                  // Replace the optimistic assistant message with an error message
                  const currentMessages = getMessages(threadId);
                  const updatedMessages = currentMessages.map(msg => {
                    if (msg.id === optimisticAssistantMessage.id) {
                      return {
                        ...msg,
                        content: errorContent,
                        isOptimistic: false,
                        isError: true,
                        rawErrorData: metadata
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
                if (metadata.imageError) {
                  console.error(`[STREAM] Image Generation Error: ${metadata.imageError}`);
                  
                  const errorContent = `**Error**: Image generation failed: ${metadata.imageError}`;
                  
                  // Save error message to database if saveErrorMessage is available
                  if (saveErrorMessage) {
                    try {
                      await saveErrorMessage.mutateAsync({
                        threadId,
                        content: errorContent,
                        rawErrorData: metadata
                      });
                      console.log('[STREAM] Image error message saved to database');
                    } catch (error) {
                      console.error('[STREAM] Failed to save image error message:', error);
                    }
                  }
                  
                  // Replace the optimistic assistant message with an error message
                  const currentMessages = getMessages(threadId);
                  const updatedMessages = currentMessages.map(msg => {
                    if (msg.id === optimisticAssistantMessage.id) {
                      return {
                        ...msg,
                        content: errorContent,
                        isOptimistic: false,
                        isError: true,
                        rawErrorData: metadata
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
                
                const errorContent = `**Error**: Failed to parse response metadata`;
                const errorData = { 
                  parseError: sanitizeErrorForStorage(e), 
                  rawLine: line 
                };
                
                // Save error message to database if saveErrorMessage is available
                if (saveErrorMessage) {
                  try {
                    await saveErrorMessage.mutateAsync({
                      threadId,
                      content: errorContent,
                      rawErrorData: errorData
                    });
                    console.log('[STREAM] Parse error message saved to database');
                  } catch (error) {
                    console.error('[STREAM] Failed to save parse error message:', error);
                  }
                }
                
                // Replace the optimistic assistant message with an error message
                const currentMessages = getMessages(threadId);
                const updatedMessages = currentMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    return {
                      ...msg,
                      content: errorContent,
                      isOptimistic: false,
                      isError: true,
                      rawErrorData: errorData
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
            }
            else if (line.startsWith('0:')) {
              // Content chunk - optimize for performance
              try {
                const jsonStr = line.slice(2);
                
                // Basic validation for content JSON - should be a simple string value
                if (!jsonStr.trim().startsWith('"') || !jsonStr.trim().endsWith('"')) {
                  throw new Error(`Invalid content chunk format: ${jsonStr}`);
                }
                
                const contentChunk = JSON.parse(jsonStr);
                const isFirstChunk = fullContent === "";
                
                // Track first chunk timing
                if (isFirstChunk && streamingStatsRef.current.firstChunkTime === 0) {
                  streamingStatsRef.current.firstChunkTime = performance.now();
                  const ttfb = streamingStatsRef.current.firstChunkTime - streamStartTime;
                  console.log(`[STREAM] TTFB: ${ttfb.toFixed(2)}ms`);
                  
                  // Clear loading state on first content chunk
                  setLoading(null, false);
                  console.log(`[STREAM] First content chunk received - cleared loading state`);
                }
                
                fullContent += contentChunk;
                
                // Add to buffer instead of immediate UI update
                contentBufferRef.current.buffer = fullContent;
                
                // Update stream data with latest content
                if (currentStreamDataRef.current) {
                  currentStreamDataRef.current.fullContent = fullContent;
                }
                
                // Schedule buffer flush if not already scheduled
                if (!contentBufferRef.current.flushTimer) {
                  contentBufferRef.current.flushTimer = setTimeout(() => {
                    flushContentBuffer(threadId, optimisticAssistantMessage.id);
                  }, 16); // ~60fps updates
                }
                
                // Auto-scroll to bottom during streaming (debounced)
                debouncedScroll(() => scrollToBottomPinned());
                
                // Keep input focused during streaming so user can immediately type next message
                if (document.activeElement !== inputRef.current) {
                  smartFocus(inputRef, { reason: 'stream-content' });
                }
              } catch (e) {
                console.error('[STREAM] Failed to parse content chunk:', e);
                
                const errorContent = `**Error**: Failed to parse response content`;
                const errorData = { 
                  parseError: sanitizeErrorForStorage(e), 
                  rawLine: line 
                };
                
                // Save error message to database if saveErrorMessage is available
                if (saveErrorMessage) {
                  try {
                    await saveErrorMessage.mutateAsync({
                      threadId,
                      content: errorContent,
                      rawErrorData: errorData
                    });
                    console.log('[STREAM] Content parse error message saved to database');
                  } catch (error) {
                    console.error('[STREAM] Failed to save content parse error message:', error);
                  }
                }
                
                // Replace the optimistic assistant message with an error message
                const currentMessages = getMessages(threadId);
                const updatedMessages = currentMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    return {
                      ...msg,
                      content: errorContent,
                      isOptimistic: false,
                      isError: true,
                      rawErrorData: errorData
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
            }
            else if (line.startsWith('d:')) {
              // Done signal - flush final content and save
              try {
                const jsonStr = line.slice(2);
                
                // Basic check for complete JSON object
                if (!jsonStr.trim().startsWith('{') || !jsonStr.trim().endsWith('}')) {
                  throw new Error(`Incomplete JSON done signal: ${jsonStr}`);
                }
                
                const doneData = JSON.parse(jsonStr);
                console.log(`[STREAM] Stream done, final content length: ${fullContent.length}, server reported: ${doneData.length || 'unknown'}`);
                
                // Force flush any remaining content
                flushContentBuffer(threadId, optimisticAssistantMessage.id, true);
                
                // For image generation, use the message from the done signal if no content was accumulated
                const finalContent = imageGenerated && !fullContent ? (doneData.message || "") : fullContent;
                
                // Calculate final streaming stats
                const streamDuration = performance.now() - streamStartTime;
                const avgChunkSize = streamingStatsRef.current.totalBytes / streamingStatsRef.current.totalChunks;
                const tokensPerSecond = finalContent.length / (streamDuration / 1000);
                
                console.log(`[STREAM] Final stats: ${streamDuration.toFixed(2)}ms, ${streamingStatsRef.current.totalChunks} chunks, ${avgChunkSize.toFixed(1)} avg chunk size, ${tokensPerSecond.toFixed(1)} chars/sec`);
                
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
                
                // Clean up streaming state
                isStreamingRef.current = false;
                lastStreamCompletedAt.current = Date.now();
                setStreaming(null, false);
                setLoading(null, false);
                
                // Auto-focus input after streaming completes so user can immediately type next message
                smartFocus(inputRef, { delay: 200, reason: 'stream-complete' });
                
                performanceMonitor.mark(`stream-${threadId}-end`);
                performanceMonitor.measure(`stream-${threadId}`, `stream-${threadId}-start`, `stream-${threadId}-end`);
                
                return;
              } catch (e) {
                console.error('[STREAM] Failed to parse done signal:', e);
                
                const errorContent = `**Error**: Failed to parse completion signal`;
                const errorData = { 
                  parseError: sanitizeErrorForStorage(e), 
                  rawLine: line 
                };
                
                // Save error message to database if saveErrorMessage is available
                if (saveErrorMessage) {
                  try {
                    await saveErrorMessage.mutateAsync({
                      threadId,
                      content: errorContent,
                      rawErrorData: errorData
                    });
                    console.log('[STREAM] Done signal parse error message saved to database');
                  } catch (error) {
                    console.error('[STREAM] Failed to save done signal parse error message:', error);
                  }
                }
                
                // Replace the optimistic assistant message with an error message
                const currentMessages = getMessages(threadId);
                const updatedMessages = currentMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    return {
                      ...msg,
                      content: errorContent,
                      isOptimistic: false,
                      isError: true,
                      rawErrorData: errorData
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
            }
          }
        }
        
        // Process any remaining buffered line when stream ends
        if (lineBuffer.trim()) {
          console.log(`[STREAM] Processing final buffered line: ${lineBuffer.substring(0, 100)}...`);
          
                     // Handle the final line using the same logic
           if (lineBuffer.startsWith('f:')) {
             try {
               const jsonStr = lineBuffer.slice(2);
               
               // Basic check for complete JSON
               if (!jsonStr.trim().startsWith('{') || !jsonStr.trim().endsWith('}')) {
                 throw new Error(`Incomplete JSON metadata in final buffer: ${jsonStr}`);
               }
               
               const metadata = JSON.parse(jsonStr);
              if (metadata.error) {
                console.error(`[STREAM] Final line API Error: ${metadata.error}`);
                
                const errorContent = `**Error**: ${metadata.error}`;
                
                if (saveErrorMessage) {
                  try {
                    await saveErrorMessage.mutateAsync({
                      threadId,
                      content: errorContent,
                      rawErrorData: metadata
                    });
                    console.log('[STREAM] Final line error message saved to database');
                  } catch (error) {
                    console.error('[STREAM] Failed to save final line error message:', error);
                  }
                }
                
                const currentMessages = getMessages(threadId);
                const updatedMessages = currentMessages.map(msg => {
                  if (msg.id === optimisticAssistantMessage.id) {
                    return {
                      ...msg,
                      content: errorContent,
                      isOptimistic: false,
                      isError: true,
                      rawErrorData: metadata
                    };
                  }
                  return msg;
                });
                setMessages(threadId, updatedMessages);
                
                setLoading(null, false);
                setStreaming(null, false);
                isStreamingRef.current = false;
                return;
              }
            } catch (e) {
              console.error('[STREAM] Failed to parse final buffered metadata line:', e);
              
              const errorContent = `**Error**: Failed to parse final response metadata`;
              const errorData = { 
                parseError: sanitizeErrorForStorage(e), 
                rawLine: lineBuffer 
              };
              
              if (saveErrorMessage) {
                try {
                  await saveErrorMessage.mutateAsync({
                    threadId,
                    content: errorContent,
                    rawErrorData: errorData
                  });
                  console.log('[STREAM] Final line parse error message saved to database');
                } catch (error) {
                  console.error('[STREAM] Failed to save final line parse error message:', error);
                }
              }
              
              const currentMessages = getMessages(threadId);
              const updatedMessages = currentMessages.map(msg => {
                if (msg.id === optimisticAssistantMessage.id) {
                  return {
                    ...msg,
                    content: errorContent,
                    isOptimistic: false,
                    isError: true,
                    rawErrorData: errorData
                  };
                }
                return msg;
              });
              setMessages(threadId, updatedMessages);
              
              setLoading(null, false);
              setStreaming(null, false);
              isStreamingRef.current = false;
              return;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      console.error('[STREAM] Streaming error:', error);
      
      // Handle abort gracefully
      if (error.name === 'AbortError') {
        console.log('[STREAM] Stream aborted by user');
        return;
      }
      
      const errorMessage = error.message || 'Failed to generate response';
      const errorContent = `**Error**: ${errorMessage}`;
      
      // Sanitize error data for database storage
      const sanitizedErrorData = sanitizeErrorForStorage(error);
      
      // Save error message to database if saveErrorMessage is available
      if (saveErrorMessage) {
        try {
          await saveErrorMessage.mutateAsync({
            threadId,
            content: errorContent,
            rawErrorData: sanitizedErrorData
          });
          console.log('[STREAM] Stream error message saved to database');
        } catch (saveError) {
          console.error('[STREAM] Failed to save stream error message:', saveError);
        }
      }
      
      // Replace the optimistic assistant message with an error message
      const currentMessages = getMessages(threadId);
      const updatedMessages = currentMessages.map(msg => {
        if (msg.id === optimisticAssistantMessage.id) {
          return {
            ...msg,
            content: errorContent,
            isOptimistic: false,
            isError: true,
            rawErrorData: error
          };
        }
        return msg;
      });
      setMessages(threadId, updatedMessages);
      
      // Clear states
      isStreamingRef.current = false;
      setStreaming(null, false);
      setLoading(null, false);
      abortControllerRef.current = null;
      currentStreamDataRef.current = null;
      
      // Reset content buffer
      contentBufferRef.current = {
        buffer: '',
        lastFlush: 0,
        flushTimer: null
      };
    }
  };

  // Get streaming performance stats
  const getStreamingStats = useCallback(() => {
    return {
      ...streamingStatsRef.current,
      isStreaming: isStreamingRef.current,
      lastCompleted: lastStreamCompletedAt.current
    };
  }, []);

  return {
    streamResponse,
    stopStream,
    getStreamingStats,
    isStreaming: () => isStreamingRef.current,
    isStreamingRef,
    lastStreamCompletedAt
  };
}; 