export const getDefaultModel = (bestDefaultModel: any): string => {
  if (bestDefaultModel) {
    if (bestDefaultModel.modelId) {
      return bestDefaultModel.modelId;
    }
    if (bestDefaultModel.reason === "no_api_keys") {
      return 'gpt-4o';
    }
  }
  
  return 'gpt-4o';
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
      setTimeout(() => setShouldShake(false), 500);
    }
  };
};

export const navigateToSettings = (onNavigateToSettings?: () => void) => {
  if (onNavigateToSettings) {
    onNavigateToSettings();
  } else {
    window.location.href = '/?view=settings&tab=api-keys';
  }
};

export const adjustTextareaHeight = (inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) => {
  const textarea = inputRef.current;
  if (textarea) {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 128;
    const minHeight = 20;
    
    textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
  }
};

export const isMobileDevice = (() => {
  let cachedResult: boolean | null = null;
  
  return () => {
    if (cachedResult !== null) return cachedResult;
    if (typeof window === 'undefined') return false;
    
    const checks = {
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isSmallScreen: window.innerWidth <= 768 || window.innerHeight <= 1024,
      isMobileUA: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(navigator.userAgent),
      matchesMediaQuery: window.matchMedia?.('(pointer: coarse)')?.matches,
    };
    
    const isMobile = checks.hasTouch && (
      checks.isSmallScreen || 
      checks.isMobileUA || 
      checks.matchesMediaQuery
    );
    
    cachedResult = isMobile;
    return isMobile;
  };
})();

// FIXED: Simplified smart focus without problematic mobile restrictions
export const smartFocus = (inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, options: {
  force?: boolean;
  delay?: number;
  reason?: string;
  respectMobile?: boolean;
} = {}) => {
  const { force = false, delay = 0, reason = 'unknown', respectMobile = true } = options;
  
  const doFocus = () => {
    try {
      inputRef.current?.focus({ preventScroll: true });
    } catch (error) {
      console.warn('[FOCUS] Focus failed:', error);
    }
  };
  
  if (force) {
    if (delay > 0) {
      setTimeout(doFocus, delay);
    } else {
      doFocus();
    }
    return;
  }
  
  // FIXED: Only skip focus for very specific problematic scenarios
  if (respectMobile && isMobileDevice()) {
    const allowedReasons = ['user-click', 'example-click', 'explicit-focus'];
    if (!allowedReasons.includes(reason)) {
      console.log(`[FOCUS] Skipping auto-focus on mobile (reason: ${reason})`);
      return;
    }
  }
  
  if (delay > 0) {
    setTimeout(doFocus, delay);
  } else {
    doFocus();
  }
};

// FIXED: Remove problematic global touch listeners
class InteractionTracker {
  private lastUserInteraction = 0;
  private cleanupFunctions: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    const updateInteraction = () => {
      this.lastUserInteraction = Date.now();
    };

    // FIXED: Only track essential events, no touchmove/scroll
    const events: Array<[string, EventListener]> = [
      ['click', updateInteraction],
      ['keydown', updateInteraction],
      ['input', updateInteraction],
    ];

    events.forEach(([event, handler]) => {
      window.addEventListener(event, handler, { passive: true });
      this.cleanupFunctions.push(() => {
        window.removeEventListener(event, handler);
      });
    });
  }

  cleanup() {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
  }

  getLastInteraction() {
    return this.lastUserInteraction;
  }
}

let interactionTracker: InteractionTracker | null = null;

export const getInteractionTracker = () => {
  if (!interactionTracker && typeof window !== 'undefined') {
    interactionTracker = new InteractionTracker();
    
    window.addEventListener('beforeunload', () => {
      if (interactionTracker) {
        interactionTracker.cleanup();
        interactionTracker = null;
      }
    });
  }
  return interactionTracker;
};

export const updateLastUserInteraction = () => {
  getInteractionTracker()?.getLastInteraction();
};

// FIXED: Remove problematic scroll tracking
export const setUserScrolling = (scrolling: boolean) => {
  console.warn('setUserScrolling is deprecated');
};