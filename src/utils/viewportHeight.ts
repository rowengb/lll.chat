// Utility to handle mobile viewport height issues
// This fixes the problem where 100vh doesn't account for mobile browser UI

let isInitialized = false;

export function initViewportHeight() {
  if (typeof window === 'undefined' || isInitialized) return;
  
  function updateViewportHeight() {
    // Calculate the actual viewport height
    const vh = window.innerHeight * 0.01;
    // Set the CSS custom property
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Handle visual viewport for keyboard-aware layouts
    if (window.visualViewport) {
      const visualVh = window.visualViewport.height * 0.01;
      document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
      
      // Calculate keyboard height for mobile layouts
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      
      // Debug log for mobile testing
      if (window.innerWidth < 640) {
        console.log(`[ViewportHeight] innerHeight: ${window.innerHeight}px, visualHeight: ${window.visualViewport.height}px, keyboard: ${keyboardHeight}px`);
      }
    } else {
      // Fallback for browsers without visual viewport support
      document.documentElement.style.setProperty('--visual-vh', `${vh}px`);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    }
    
    // Debug log for mobile testing
    if (window.innerWidth < 640) {
      console.log(`[ViewportHeight] Updated --vh to ${vh}px (innerHeight: ${window.innerHeight}px)`);
    }
  }

  // Set initial value
  updateViewportHeight();

  // Listen for resize events (including when mobile browser UI shows/hides)
  window.addEventListener('resize', updateViewportHeight);
  
  // Listen for orientation changes
  window.addEventListener('orientationchange', () => {
    // Delay to ensure the browser has updated the viewport
    setTimeout(updateViewportHeight, 100);
  });

  // Listen for visual viewport changes (iOS Safari specific)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
  }

  isInitialized = true;
}

// Clean up event listeners (useful for SSR)
export function cleanupViewportHeight() {
  if (typeof window === 'undefined' || !isInitialized) return;
  
  window.removeEventListener('resize', updateViewportHeight);
  window.removeEventListener('orientationchange', updateViewportHeight);
  
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', updateViewportHeight);
    window.visualViewport.removeEventListener('scroll', updateViewportHeight);
  }
  
  isInitialized = false;
}

function updateViewportHeight() {
  if (typeof window === 'undefined') return;
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // Handle visual viewport for keyboard-aware layouts
  if (window.visualViewport) {
    const visualVh = window.visualViewport.height * 0.01;
    document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
    
    // Calculate keyboard height for mobile layouts
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
  } else {
    // Fallback for browsers without visual viewport support
    document.documentElement.style.setProperty('--visual-vh', `${vh}px`);
    document.documentElement.style.setProperty('--keyboard-height', '0px');
  }
} 