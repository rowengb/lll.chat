import { useRef, useState, useEffect } from "react";

export const useChatScrolling = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messagesContainer, setMessagesContainer] = useState<HTMLDivElement | null>(null);
  const scrollLocked = useRef<boolean>(false);

  // Simple scroll container setup - no artificial activation needed
  useEffect(() => {
    // Natural scrolling works without hacks
    if (messagesContainer) {
      // Just ensure scroll is at bottom on mount
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [messagesContainer]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Immediate scroll function for streaming - pinned to bottom in real-time
  const scrollToBottomImmediate = () => {
    // Use instant behavior for immediate pinning during streaming
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  // Aggressive scroll function that ensures we stay pinned to bottom
  const scrollToBottomPinned = () => {
    if (messagesContainer) {
      // Force scroll to absolute bottom immediately
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
      // Fallback to scrollIntoView
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
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

  return {
    messagesEndRef,
    messagesContainer,
    setMessagesContainer,
    scrollLocked,
    scrollToBottom,
    scrollToBottomImmediate,
    scrollToBottomPinned,
    handleGroundingSourcesToggle
  };
}; 