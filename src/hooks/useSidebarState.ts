import { useState, useEffect } from 'react';

export function useSidebarState() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // Default 18rem = 288px
  const [lastExpandedWidth, setLastExpandedWidth] = useState(288); // Store the last expanded width

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      const savedWidth = localStorage.getItem('sidebarWidth');
      const savedLastExpandedWidth = localStorage.getItem('sidebarLastExpandedWidth');
      
      if (savedCollapsed !== null) {
        setSidebarCollapsed(JSON.parse(savedCollapsed));
      }
      
      if (savedWidth !== null) {
        setSidebarWidth(parseInt(savedWidth, 10));
      }
      
      if (savedLastExpandedWidth !== null) {
        setLastExpandedWidth(parseInt(savedLastExpandedWidth, 10));
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarWidth', sidebarWidth.toString());
      // If sidebar is not collapsed, update the last expanded width
      if (!sidebarCollapsed && sidebarWidth > 0) {
        setLastExpandedWidth(sidebarWidth);
        localStorage.setItem('sidebarLastExpandedWidth', sidebarWidth.toString());
      }
    }
  }, [sidebarWidth, sidebarCollapsed]);

  const handleToggleCollapse = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    // Use the last expanded width when expanding, or 0 when collapsing
    setSidebarWidth(newCollapsed ? 0 : lastExpandedWidth);
  };

  return {
    sidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    handleToggleCollapse,
  };
} 