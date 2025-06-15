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