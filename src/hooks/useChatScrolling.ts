import { useRef, useCallback } from "react";

export const useChatScrolling = (getMessagesContainer: () => HTMLDivElement | null) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollLocked = useRef<boolean>(false);

  // Simple, reliable scroll to bottom
  const scrollToBottomPinned = useCallback(() => {
    const container = getMessagesContainer();
    if (container) {
      // Use requestAnimationFrame for smooth performance
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      // Fallback to scrollIntoView
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [getMessagesContainer]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollToBottomImmediate = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  const handleGroundingSourcesToggle = useCallback((
    isExpanded: boolean, 
    elementRef: HTMLDivElement | null
  ) => {
    const container = getMessagesContainer();
    if (!elementRef || !container) return;

    // Simplified scroll adjustment
    requestAnimationFrame(() => {
      const elementRect = elementRef.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (isExpanded) {
        const elementBottom = elementRect.bottom;
        const visibleBottom = containerRect.bottom - 160; // Chatbox height
        
        if (elementBottom > visibleBottom) {
          const scrollAmount = elementBottom - visibleBottom + 40;
          container.scrollTo({
            top: container.scrollTop + scrollAmount,
            behavior: 'smooth'
          });
        }
      }
    });
  }, [getMessagesContainer]);

  return {
    messagesEndRef,
    scrollLocked,
    scrollToBottom,
    scrollToBottomImmediate,
    scrollToBottomPinned,
    handleGroundingSourcesToggle
  };
};