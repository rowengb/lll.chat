import React, { useEffect, useRef, useState } from 'react';

interface CustomScrollbarProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onRef?: (ref: HTMLDivElement | null) => void;
}

export function CustomScrollbar({ children, className = '', style = {}, onRef }: CustomScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollbar, setShowScrollbar] = useState(false);

  const updateScrollbar = () => {
    if (!containerRef.current || !contentRef.current) return;

    const container = containerRef.current;
    const content = contentRef.current;
    
    const containerHeight = container.clientHeight;
    const contentHeight = content.scrollHeight;
    const scrollTop = content.scrollTop;

    // Check if scrollbar is needed (with small buffer to prevent flickering)
    const needsScrollbar = contentHeight > containerHeight + 1;
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[CustomScrollbar] Content: ${contentHeight}px, Container: ${containerHeight}px, Needs scrollbar: ${needsScrollbar}, Current showing: ${showScrollbar}`);
    }
    
    setShowScrollbar(needsScrollbar);

    if (!needsScrollbar) return;

    // Calculate thumb height (proportional to visible content)
    const thumbHeightRatio = containerHeight / contentHeight;
    const calculatedThumbHeight = Math.max(20, containerHeight * thumbHeightRatio);
    setThumbHeight(calculatedThumbHeight);

    // Calculate thumb position
    const maxScrollTop = contentHeight - containerHeight;
    const scrollRatio = scrollTop / maxScrollTop;
    const maxThumbTop = containerHeight - calculatedThumbHeight;
    const calculatedThumbTop = scrollRatio * maxThumbTop;
    setThumbTop(calculatedThumbTop);
  };

  const handleScroll = () => {
    updateScrollbar();
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !contentRef.current) return;
    if (e.target !== e.currentTarget) return; // Only handle clicks on track, not thumb
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const container = containerRef.current;
    const content = contentRef.current;
    
    // Calculate target scroll position
    const scrollRatio = clickY / container.clientHeight;
    const maxScrollTop = content.scrollHeight - container.clientHeight;
    const targetScrollTop = scrollRatio * maxScrollTop;
    
    // Smooth scroll to target
    content.scrollTo({
      top: Math.max(0, Math.min(targetScrollTop, maxScrollTop)),
      behavior: 'smooth'
    });
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const startY = e.clientY;
    const startThumbTop = thumbTop;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !contentRef.current) return;
      
      const deltaY = e.clientY - startY;
      const container = containerRef.current;
      const content = contentRef.current;
      
      const maxThumbTop = container.clientHeight - thumbHeight;
      const newThumbTop = Math.max(0, Math.min(startThumbTop + deltaY, maxThumbTop));
      
      // Convert thumb position to scroll position
      const scrollRatio = maxThumbTop > 0 ? newThumbTop / maxThumbTop : 0;
      const maxScrollTop = content.scrollHeight - container.clientHeight;
      const newScrollTop = scrollRatio * maxScrollTop;
      
      content.scrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
    
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    // Expose the content ref to parent
    if (onRef) {
      onRef(content);
    }

    content.addEventListener('scroll', handleScroll);
    
    // Initial calculation
    updateScrollbar();
    
    // Update on resize
    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(content);
    
    // Also observe the container for layout changes
    const containerResizeObserver = new ResizeObserver(updateScrollbar);
    if (containerRef.current) {
      containerResizeObserver.observe(containerRef.current);
    }
    
    // Watch for content changes (DOM mutations)
    const mutationObserver = new MutationObserver(() => {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(updateScrollbar);
    });
    
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    return () => {
      content.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      containerResizeObserver.disconnect();
      mutationObserver.disconnect();
      if (onRef) {
        onRef(null);
      }
    };
  }, [onRef]);

  // Add effect to update scrollbar when children change
  useEffect(() => {
    // Use a small delay to ensure DOM has updated
    const timeoutId = setTimeout(() => {
      updateScrollbar();
    }, 10);
    
    return () => clearTimeout(timeoutId);
  }, [children]);

  return (
    <div 
      ref={containerRef}
      className={`custom-scrollbar-container ${className}`}
      style={style}
    >
      <div 
        ref={contentRef}
        className="sm:hidden-scrollbar h-full"
        style={{ overflow: 'auto' }}
      >
        {children}
      </div>
      
      {showScrollbar && (
        <div 
          className="custom-scrollbar-track hidden sm:block"
          onClick={handleTrackClick}
        >
          <div
            ref={thumbRef}
            className="custom-scrollbar-thumb"
            style={{
              height: `${thumbHeight}px`,
              top: `${thumbTop}px`,
              opacity: isDragging ? 0.8 : 0.6
            }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
} 