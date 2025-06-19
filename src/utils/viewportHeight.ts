// Utility to handle mobile viewport height issues
// This fixes the problem where 100vh doesn't account for mobile browser UI

let isInitialized = false;
let debounceTimer: NodeJS.Timeout | null = null;
let lastKeyboardHeight = 0;

export function initViewportHeight() {
  if (typeof window === 'undefined' || isInitialized) return;
  
  function updateViewportHeight() {
    // Clear any pending debounced update
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Debounce the update to prevent flickering
    debounceTimer = setTimeout(() => {
      performViewportUpdate();
    }, 16); // One frame at 60fps
  }

  function performViewportUpdate() {
    // Calculate the actual viewport height
    const vh = window.innerHeight * 0.01;
    // Set the CSS custom property
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    let keyboardHeight = 0;
    let visualVh = vh;
    
    // Handle visual viewport for keyboard-aware layouts
    if (window.visualViewport) {
      visualVh = window.visualViewport.height * 0.01;
      keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
      
      // Only update if there's a significant change (prevents micro-adjustments)
      if (Math.abs(keyboardHeight - lastKeyboardHeight) > 5) {
        lastKeyboardHeight = keyboardHeight;
      } else {
        keyboardHeight = lastKeyboardHeight;
      }
    }
    
    // Alternative detection for iOS Safari issues
    if (keyboardHeight === 0 && window.innerWidth < 640) {
      // Check if we're likely in a keyboard state by comparing viewport ratios
      const viewportRatio = window.innerHeight / window.screen.height;
      if (viewportRatio < 0.7) {
        // Likely keyboard is open, estimate height
        keyboardHeight = Math.max(0, window.screen.height * 0.4 - window.innerHeight);
        visualVh = window.innerHeight * 0.01;
      }
    }
    
    // Set CSS custom properties
    document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    
    // Debug log for mobile testing
    if (window.innerWidth < 640) {
      console.log(`[ViewportHeight] innerHeight: ${window.innerHeight}px, visualHeight: ${window.visualViewport?.height || window.innerHeight}px, keyboard: ${keyboardHeight}px, ratio: ${(window.innerHeight / window.screen.height).toFixed(2)}`);
    }
    
    // Force a repaint to ensure CSS updates are applied
    document.documentElement.offsetHeight;
  }

  // Set initial value immediately
  performViewportUpdate();

  // Listen for resize events (including when mobile browser UI shows/hides)
  window.addEventListener('resize', updateViewportHeight, { passive: true });
  
  // Listen for orientation changes
  window.addEventListener('orientationchange', () => {
    // Multiple delays to handle different iOS timing issues
    setTimeout(updateViewportHeight, 100);
    setTimeout(updateViewportHeight, 300);
    setTimeout(updateViewportHeight, 500);
  });

  // Listen for visual viewport changes (iOS Safari specific)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight, { passive: true });
    window.visualViewport.addEventListener('scroll', updateViewportHeight, { passive: true });
  }

  // Additional iOS-specific listeners
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    // iOS Safari fires focus/blur on input elements
    document.addEventListener('focusin', () => {
      setTimeout(updateViewportHeight, 100);
      setTimeout(updateViewportHeight, 300);
    }, { passive: true });
    
    document.addEventListener('focusout', () => {
      setTimeout(updateViewportHeight, 100);
      setTimeout(updateViewportHeight, 300);
    }, { passive: true });
    
    // Listen for scroll events that might indicate keyboard changes
    window.addEventListener('scroll', updateViewportHeight, { passive: true });
  }

  isInitialized = true;
}

// Clean up event listeners (useful for SSR)
export function cleanupViewportHeight() {
  if (typeof window === 'undefined' || !isInitialized) return;
  
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  
  window.removeEventListener('resize', updateViewportHeight);
  window.removeEventListener('orientationchange', updateViewportHeight);
  window.removeEventListener('scroll', updateViewportHeight);
  
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', updateViewportHeight);
    window.visualViewport.removeEventListener('scroll', updateViewportHeight);
  }
  
  document.removeEventListener('focusin', updateViewportHeight);
  document.removeEventListener('focusout', updateViewportHeight);
  
  isInitialized = false;
}

function updateViewportHeight() {
  if (typeof window === 'undefined') return;
  
  // Clear any pending debounced update
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Debounce the update to prevent flickering
  debounceTimer = setTimeout(() => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    let keyboardHeight = 0;
    let visualVh = vh;
    
    // Handle visual viewport for keyboard-aware layouts
    if (window.visualViewport) {
      visualVh = window.visualViewport.height * 0.01;
      keyboardHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
      
      // Only update if there's a significant change (prevents micro-adjustments)
      if (Math.abs(keyboardHeight - lastKeyboardHeight) > 5) {
        lastKeyboardHeight = keyboardHeight;
      } else {
        keyboardHeight = lastKeyboardHeight;
      }
    }
    
    // Alternative detection for iOS Safari issues
    if (keyboardHeight === 0 && window.innerWidth < 640) {
      // Check if we're likely in a keyboard state by comparing viewport ratios
      const viewportRatio = window.innerHeight / window.screen.height;
      if (viewportRatio < 0.7) {
        // Likely keyboard is open, estimate height
        keyboardHeight = Math.max(0, window.screen.height * 0.4 - window.innerHeight);
        visualVh = window.innerHeight * 0.01;
      }
    }
    
    // Set CSS custom properties
    document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    
    // Force a repaint to ensure CSS updates are applied
    document.documentElement.offsetHeight;
  }, 16); // One frame at 60fps
} 