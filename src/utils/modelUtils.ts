// Check if a model is for image generation
export const isImageGenerationModel = (model?: string | null) => {
  if (!model) return false;
  return model.includes("image") || model.includes("dall-e") || model === "gpt-image-1";
};

// Check if a model supports specific capabilities
export const modelSupportsCapability = (model?: string | null, capability?: string) => {
  if (!model || !capability) return false;
  
  // This could be expanded to check against a model database
  // For now, we'll use simple string matching
  switch (capability) {
    case 'image-generation':
      return isImageGenerationModel(model);
    case 'vision':
      return model.includes('gpt-4') || model.includes('claude') || model.includes('gemini');
    case 'reasoning':
      return model.includes('o1') || model.includes('o3') || model.includes('reasoning') || model.includes('deepseek-r1');
    default:
      return false;
  }
}; 