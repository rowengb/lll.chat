import { create } from 'zustand';

interface ImageLoadingState {
  [imageUrl: string]: {
    isLoaded: boolean;
    hasError: boolean;
  };
}

interface ImageStore {
  imageStates: ImageLoadingState;
  setImageLoaded: (imageUrl: string) => void;
  setImageError: (imageUrl: string) => void;
  getImageState: (imageUrl: string) => { isLoaded: boolean; hasError: boolean };
  clearImageState: (imageUrl: string) => void;
}

export const useImageStore = create<ImageStore>((set, get) => ({
  imageStates: {},
  
  setImageLoaded: (imageUrl: string) => {
    if (imageUrl === "GENERATING") return; // Don't track GENERATING placeholder
    
    set((state) => ({
      imageStates: {
        ...state.imageStates,
        [imageUrl]: {
          isLoaded: true,
          hasError: false,
        },
      },
    }));
  },
  
  setImageError: (imageUrl: string) => {
    if (imageUrl === "GENERATING") return; // Don't track GENERATING placeholder
    
    set((state) => ({
      imageStates: {
        ...state.imageStates,
        [imageUrl]: {
          isLoaded: false,
          hasError: true,
        },
      },
    }));
  },
  
  getImageState: (imageUrl: string) => {
    if (imageUrl === "GENERATING") {
      return { isLoaded: false, hasError: false };
    }
    
    const state = get().imageStates[imageUrl];
    return state || { isLoaded: false, hasError: false };
  },
  
  clearImageState: (imageUrl: string) => {
    set((state) => {
      const newStates = { ...state.imageStates };
      delete newStates[imageUrl];
      return { imageStates: newStates };
    });
  },
})); 