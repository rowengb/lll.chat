export const getDefaultModel = (bestDefaultModel: any): string => {
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

export const getProviderFromModel = (modelId?: string | null, allModels?: any[]): string => {
  if (!modelId || !allModels) return "openai";
  
  const modelData = allModels.find(m => m.id === modelId);
  return modelData?.provider || "openai";
};

export const createShakeAnimation = () => {
  return {
    trigger: (setShouldShake: (value: boolean) => void) => {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500); // Reset after animation duration
    }
  };
};

export const navigateToSettings = (onNavigateToSettings?: () => void) => {
  // Use the parent's navigation function if available, otherwise fallback to window.location
  if (onNavigateToSettings) {
    onNavigateToSettings();
  } else {
    window.location.href = '/?view=settings&tab=api-keys';
  }
};

// Auto-resize textarea helper
export const adjustTextareaHeight = (inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) => {
  const textarea = inputRef.current;
  if (textarea) {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 128; // max-h-32 = 128px
    const minHeight = 20; // Even slimmer default height
    
    textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
  }
};

// Mobile detection utility
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for touch capability and screen size
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return isTouchDevice && (isSmallScreen || isMobileUserAgent);
};

// Track user interaction state
let lastUserInteraction = 0;
let isUserScrolling = false;
let scrollTimeout: NodeJS.Timeout | null = null;

// Update last interaction time
export const updateLastUserInteraction = () => {
  lastUserInteraction = Date.now();
};

// Track scrolling state
export const setUserScrolling = (scrolling: boolean) => {
  isUserScrolling = scrolling;
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  if (scrolling) {
    scrollTimeout = setTimeout(() => {
      isUserScrolling = false;
    }, 1000); // Consider scrolling stopped after 1 second
  }
};

// Smart focus function that respects mobile UX
export const smartFocus = (inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, options: {
  force?: boolean;
  delay?: number;
  reason?: string;
} = {}) => {
  const { force = false, delay = 0, reason = 'unknown' } = options;
  
  // Always allow focus on desktop
  if (!isMobileDevice() || force) {
    if (delay > 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, delay);
    } else {
      inputRef.current?.focus();
    }
    return;
  }
  
  // On mobile, be more selective about when to focus
  const timeSinceLastInteraction = Date.now() - lastUserInteraction;
  
  // Don't focus if:
  // 1. User is currently scrolling
  // 2. User hasn't interacted recently (likely just browsing/reading)
  // 3. Focus was triggered by automatic events (like thread changes, message completion)
  if (isUserScrolling) {
    console.log(`[FOCUS] Skipping focus on mobile - user is scrolling (reason: ${reason})`);
    return;
  }
  
  if (timeSinceLastInteraction > 5000 && !force) {
    console.log(`[FOCUS] Skipping focus on mobile - no recent user interaction (reason: ${reason})`);
    return;
  }
  
  // Allow focus for user-initiated actions
  if (reason === 'user-action' || reason === 'form-submit' || reason === 'example-click') {
    if (delay > 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, delay);
    } else {
      inputRef.current?.focus();
    }
    return;
  }
  
  console.log(`[FOCUS] Skipping auto-focus on mobile (reason: ${reason})`);
};

// Initialize interaction tracking
if (typeof window !== 'undefined') {
  // Track user interactions
  ['touchstart', 'touchmove', 'touchend', 'click', 'keydown', 'input'].forEach(event => {
    window.addEventListener(event, updateLastUserInteraction, { passive: true });
  });
  
  // Track scrolling
  window.addEventListener('scroll', () => setUserScrolling(true), { passive: true });
  window.addEventListener('touchmove', () => setUserScrolling(true), { passive: true });
} 