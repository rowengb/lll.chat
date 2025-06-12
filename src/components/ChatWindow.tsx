import { useState, useRef, useEffect } from "react";
import { SendIcon, CopyIcon, GitBranchIcon, RotateCcwIcon, EditIcon, Waves, PenToolIcon, CodeIcon, BrainIcon, LightbulbIcon, BarChartIcon, ChefHatIcon, ZapIcon, BotIcon, ShieldIcon } from "lucide-react";
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

// Shared layout CSS for perfect alignment
const sharedLayoutClasses = "max-w-[80%] w-full mx-auto";
const sharedGridClasses = "grid grid-cols-[1fr_min(900px,100%)_1fr] px-6";

// Slightly wider chatbox for visual hierarchy
const chatboxLayoutClasses = "max-w-[81%] w-full mx-auto";
const chatboxGridClasses = "grid grid-cols-[1fr_min(950px,100%)_1fr] px-5";

interface ChatWindowProps {
  threadId: string | null;
  onThreadCreate: (threadId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
}

interface Message {
  id: string;
  content: string;
  role: string;
  model?: string | null;
  createdAt: Date;
  isOptimistic?: boolean;
}

export function ChatWindow({ threadId, onThreadCreate, selectedModel, onModelChange, sidebarCollapsed, sidebarWidth }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messagesContainer, setMessagesContainer] = useState<HTMLDivElement | null>(null);
  
  // Use global chat store instead of local state
  const { 
    getMessages, 
    setMessages, 
    addMessage, 
    updateStreamingMessage, 
    isStreaming, 
    setStreaming,
    isLoading,
    setLoading
  } = useChatStore();
  
  // Get messages for current thread from global store
  const localMessages = threadId ? getMessages(threadId) : [];
  
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
  const { refetch: refetchThreads } = trpc.chat.getThreads.useQuery();

  // T3.chat style: Show welcome elements dynamically based on input content
  const showWelcomeElements = !threadId && input.trim() === "";

  // Handle input changes - just update input, welcome visibility is reactive
  const handleInputChange = (value: string) => {
    setInput(value);
  };

  // Robust server message sync with streaming protection
  useEffect(() => {
    // Don't sync during loading/streaming
    if (isLoading || isStreamingRef.current || !threadId) return;
    
    if (serverMessages) {
      // Only sync if we're not currently streaming
      if (!isStreamingRef.current) {
        const currentMessages = getMessages(threadId);
        // If we have optimistic messages, don't sync
        const hasOptimistic = currentMessages.some(msg => msg.isOptimistic);
        if (!hasOptimistic) {
          // Convert server messages
          const serverMsgs = serverMessages.map(msg => ({ 
            ...msg, 
            createdAt: new Date(msg._creationTime),
            isOptimistic: false 
          }));
          
          setMessages(threadId, serverMsgs);
        }
      }
    }
  }, [serverMessages, threadId, isLoading, getMessages, setMessages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
          await streamResponse(threadId, userMessage.content);
        }
      } else {
        // For assistant messages, remove this message and all after it, then resend the last user message
        const messagesToKeep = currentMessages.slice(0, messageIndex);
        setMessages(threadId, messagesToKeep);
        
        // Find the last user message to resend
        const lastUserMessage = messagesToKeep.reverse().find(msg => msg.role === "user");
        if (lastUserMessage) {
          await streamResponse(threadId, lastUserMessage.content);
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

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 128; // max-h-32 = 128px
      const minHeight = 24; // Much slimmer default height
      
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  useEffect(() => {
    // Check if we're currently streaming
    const isStreaming = localMessages.some(msg => msg.isOptimistic && msg.role === "assistant");
    
    // During streaming, use instant scroll to avoid jitter
    // Otherwise, use smooth scroll for better UX
    const behavior = isStreaming ? "instant" : "smooth";
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [localMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const messageContent = input.trim();
    setInput("");

    try {
      if (!threadId) {
        // Create thread and stream immediately - smooth T3.chat style flow
        console.log(`[SUBMIT] Creating new thread and streaming message: "${messageContent.slice(0, 30)}..."`);
        const defaultModel = getDefaultModel();
        const newThread = await createThread.mutateAsync({
          title: messageContent.slice(0, 50),
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
        };

        // Add optimistic user message BEFORE URL change
        addMessage(newThread.id, optimisticUserMessage);
        
        // NOW change URL (after optimistic message is set)
        onThreadCreate(newThread.id);

        // Start streaming response on the new thread
        await streamResponse(newThread.id, messageContent);
        
        // Refresh sidebar to show the new thread
        await refetchThreads();
      } else {
        // We're already on a thread page - stream immediately
        setLoading(threadId, true);
        
        // Create optimistic user message
        const optimisticUserMessage: Message = {
          id: `temp-user-${Date.now()}`,
          content: messageContent,
          role: "user",
          createdAt: new Date(),
          isOptimistic: true,
        };

        // Add optimistic user message
        addMessage(threadId, optimisticUserMessage);

        // Start streaming response
        await streamResponse(threadId, messageContent);
      }
      
    } catch (error) {
      console.error("Error sending message:", error);
      setLoading(null, false);
    }
  };

  const streamResponse = async (threadId: string, content: string) => {
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
    
    // Mark as streaming to prevent server sync interference
    isStreamingRef.current = true;
    setStreaming(threadId, true);

    try {
      // Get conversation history for streaming (exclude optimistic messages)
      const currentMessages = getMessages(threadId);
      const messages = currentMessages
        .filter(msg => !msg.isOptimistic)
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
              // Metadata (message ID, etc.)
              try {
                const metadata = JSON.parse(line.slice(2));
                if (metadata.messageId) {
                  messageId = metadata.messageId;
                  console.log(`[STREAM] Got message ID: ${messageId}`);
                }
                if (metadata.error) {
                  throw new Error(metadata.error);
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
                await saveStreamedMessage.mutateAsync({
                  threadId,
                  userContent: content,
                  assistantContent: fullContent,
                  model: selectedModel,
                });

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
                    // Mark assistant message as complete with model info
                    return { ...msg, isOptimistic: false, content: fullContent, model: selectedModel };
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

  const streamResponseWithModel = async (threadId: string, content: string, model: string) => {
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
      // Get conversation history for streaming (exclude the message we're retrying)
      const currentMessages = getMessages(threadId);
      const messages = currentMessages
        .filter(msg => !msg.isOptimistic) // Don't include optimistic messages
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

      // Create new thread with messages up to this point
      const result = await createThread.mutateAsync({
        title: "Branched conversation",
      });

      if (result && result.id) {
        const newThreadId = result.id;
        
        // Copy messages up to the branch point
        const messagesToCopy = currentMessages.slice(0, messageIndex);
        setMessages(newThreadId, messagesToCopy);
        
        // Navigate to new thread
        onThreadCreate(newThreadId);
      }
    } catch (error) {
      console.error("Error branching conversation:", error);
    } finally {
      setLoading(null, false);
    }
  };

  // Show welcome page when no thread exists (T3.chat style)
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
        className="fixed top-0 right-0 bottom-0 flex flex-col bg-white transition-all duration-500 ease-out"
        style={{ left: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }}
      >
        {/* Welcome Content Area with proper scrolling container for chatbox alignment */}
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-y-auto">
            <div className={`${sharedGridClasses} pt-56 pb-48`}>
              <div></div>
              <div className="w-full">
                <div className={sharedLayoutClasses}>
                  {/* Welcome elements that hide/show based on input - T3.chat style */}
                  <div className={`text-center transition-all duration-300 ${showWelcomeElements ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                    {/* Welcome Header */}
                    <div className="mb-8">
                      <h1 className="text-3xl font-light text-gray-900 mb-4">
                        Welcome to <span className="font-bold">lll</span><span className="font-normal">.chat</span>
                      </h1>
                      <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Start a conversation with AI. Choose from the examples below or type your own message.
                      </p>
                    </div>

                    {/* Example Prompts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                      {examplePrompts.map((example, index) => {
                        const IconComponent = example.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => handleExampleClick(example.prompt)}
                            className="group text-left p-4 bg-gradient-to-br from-gray-50/80 to-gray-100/60 backdrop-blur-sm hover:from-gray-100/90 hover:to-gray-150/70 rounded-2xl border border-gray-200/60 hover:border-gray-300/80 shadow-lg shadow-gray-100/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 hover:-translate-y-1 backdrop-saturate-150"
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-gray-600 mt-1 group-hover:text-gray-700 transition-colors">
                                <IconComponent className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900 mb-2 group-hover:text-black transition-colors">
                                  {example.title}
                                </h3>
                                <p className="text-sm text-gray-600 group-hover:text-gray-700 line-clamp-3 transition-colors">
                                  {example.prompt}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Features highlight */}
                    <div className="bg-gradient-to-r from-gray-50/90 to-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200/70 p-6 max-w-2xl mx-auto shadow-lg shadow-gray-100/50 backdrop-saturate-150">
                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <div className="flex justify-center mb-2">
                            <ZapIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">Lightning Fast</div>
                          <div className="text-xs text-gray-600">Real-time streaming</div>
                        </div>
                        <div>
                          <div className="flex justify-center mb-2">
                            <BotIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">Multiple Models</div>
                          <div className="text-xs text-gray-600">GPT, Claude, Gemini & more</div>
                        </div>  
                        <div>
                          <div className="flex justify-center mb-2">
                            <ShieldIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">BYOK & Privacy</div>
                          <div className="text-xs text-gray-600">Your keys, your data</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div></div>
            </div>
          </div>
          
          {/* Chatbox - Using exact same layout system as conversation view */}
          <div className="absolute bottom-6 left-0 z-20 right-0">
            <div className={chatboxGridClasses}>
              <div></div>
              <div className="w-full">
                <div className={chatboxLayoutClasses}>
                  <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-gray-200 shadow-2xl px-5 py-4 chatbox-stable">
                    <form onSubmit={handleSubmit}>
                      <div className="flex items-center gap-3">
                        <div className="textarea-container">
                          <textarea
                            ref={inputRef as any}
                            value={input}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Type your message..."
                            disabled={isLoading}
                            className="w-full border-0 bg-transparent focus:outline-none focus:ring-0 focus:border-transparent focus:shadow-none text-base py-0 px-0 transition-colors resize-none hidden-scrollbar"
                            style={{ 
                              border: 'none', 
                              outline: 'none', 
                              boxShadow: 'none',
                              height: '24px',
                              minHeight: '24px',
                              maxHeight: '120px'
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e as any);
                              }
                            }}
                          />
                        </div>
                        <Button 
                          type="submit" 
                          disabled={!input.trim() || isLoading}
                          className="rounded-xl h-12 w-12 bg-black hover:bg-gray-800 shadow-sm transition-all"
                          size="sm"
                        >
                          <SendIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="border-t border-gray-100 mt-2 pt-2 flex items-center justify-between">
                        <ModelSelector
                          selectedModel={selectedModel}
                          onModelChange={onModelChange}
                        />
                        <div className="text-xs text-gray-500">
                          Press Enter to send
                        </div>
                      </div>
                    </form>
                  </div>
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
      className="fixed top-0 right-0 bottom-0 flex flex-col bg-white transition-all duration-500 ease-out"
      style={{ left: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }}
    >


      {/* Messages + Chatbox Area */}
      <div className="flex-1 overflow-hidden relative">
        <CustomScrollbar 
          className="h-full"
          onRef={setMessagesContainer}
        >
                      <div className={`${sharedGridClasses} pt-8 pb-48`}>
            <div></div>
            <div className="w-full">
              <div className={sharedLayoutClasses} id="messages-container">
              <div className="space-y-0">
            {(() => {
              const filteredMessages = localMessages?.filter(message => 
                // Filter out empty optimistic assistant messages
                !(message.isOptimistic && message.role === "assistant" && !message.content.trim())
              ) || [];
              console.log(`[RENDER] Total messages to render: ${filteredMessages.length}`);
              return filteredMessages.map((message: Message) => {
                console.log(`[RENDER] Rendering message: ${message.role} - "${message.content.slice(0, 50)}..." (optimistic: ${message.isOptimistic})`);
                return (
              <div key={message.id} className="flex justify-start">
                <div className="w-full">
                  <div className={`${message.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"} group`}>
                                          <div
                        className={`rounded-2xl px-5 ${
                        message.role === "user" 
                          ? "py-4" 
                          : "pt-3 pb-1"
                        } ${
                        message.role === "user"
                          ? "bg-blue-50 text-gray-900 border border-blue-500 shadow-sm"
                          : "text-gray-900"
                      }`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-none bg-white"
                            rows={Math.max(2, editingContent.split('\n').length)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleSaveEdit(message.id)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
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
                        <p className="whitespace-pre-wrap text-sm leading-loose">
                          {message.content}
                        </p>
                      ) : (
                        <div className="prose prose-sm max-w-none text-gray-900 text-sm leading-loose">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                              // Customize link styling
                              a: ({ node, ...props }) => (
                                <a 
                                  {...props} 
                                  className="text-blue-600 hover:text-blue-800 underline"
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
                                    className="bg-gray-800 text-gray-100 px-2 py-1 rounded text-xs font-mono" 
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                ) : (
                                  <code 
                                    className={`${className} block bg-gray-800 text-gray-100 p-2 rounded-xl overflow-x-auto text-xs`} 
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                              // Style pre blocks
                              pre: ({ node, ...props }) => (
                                <pre 
                                  className="bg-gray-800 text-gray-100 p-2 rounded-xl overflow-x-auto my-3 text-xs"
                                  {...props}
                                />
                              ),
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
                        </div>
                      )}
                    </div>

                    {/* Message Actions - Always render to prevent layout shift */}
                    <div className={`flex items-center gap-1 ${message.role === "user" ? "mt-3" : "mt-0"} ${message.isOptimistic ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-1 mr-1">
                            <div className="flex items-center gap-1 text-sm text-gray-500 px-5">
                              {getProviderFromModel(message.model)}
                              <span>•</span>
                              <span>{message.model}</span>
                            </div>
                          </div>
                        )}
                        
                        {message.role === "user" ? (
                          // User message actions: retry, edit, copy
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryMessage(message.id, message.role === "user")}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <RotateCcwIcon className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditMessage(message.id)}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyMessage(message.content)}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          // AI message actions: copy, branch off, retry
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyMessage(message.content)}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBranchOff(message.id)}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <GitBranchIcon className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryMessage(message.id, message.role === "user")}
                              className="h-8 px-2 text-gray-400 hover:text-gray-600"
                            >
                              <RotateCcwIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                  </div>
                </div>
              </div>
            );
            });
            })()}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-full flex">
                  <div className="max-w-full rounded-2xl bg-gray-100 px-5 py-3 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500"></div>
                        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500 animation-delay-100"></div>
                        <div className="h-2 w-2 animate-pulse rounded-full bg-gray-500 animation-delay-200"></div>
                      </div>
                      <span className="text-sm text-gray-500 animate-pulse">AI is thinking...</span>
                    </div>
                  </div>
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
        
        {/* Chatbox - Absolutely positioned within scrolling container */}
        <div className="absolute bottom-6 left-0 z-20" style={{ right: `${scrollbarWidth}px` }}>
          <div className={chatboxGridClasses}>
            <div></div>
            <div className="w-full">
                              <div className={chatboxLayoutClasses}>
                  <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-gray-200 shadow-2xl px-5 py-4 chatbox-stable">
                    <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-3">
                  <div className="textarea-container">
                    <textarea
                      ref={inputRef as any}
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isLoading}
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-0 focus:border-transparent focus:shadow-none text-base py-0 px-0 transition-colors resize-none hidden-scrollbar"
                      style={{ 
                        border: 'none', 
                        outline: 'none', 
                        boxShadow: 'none',
                        height: '24px',
                        minHeight: '24px',
                        maxHeight: '120px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e as any);
                        }
                      }}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!input.trim() || isLoading}
                    className="rounded-xl h-12 w-12 bg-black hover:bg-gray-800 shadow-sm transition-all"
                    size="sm"
                  >
                    <SendIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="border-t border-gray-100 mt-2 pt-2 flex items-center justify-between">
                  <ModelSelector
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                  />
                  <div className="text-xs text-gray-500">
                    Press Enter to send
                  </div>
                </div>
                </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 