import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModelData {
  _id: string;
  id: string;
  name: string;
  displayNameTop?: string;
  displayNameBottom?: string;
  description: string;
  provider: string;
  apiUrl?: string;
  openrouterModelId?: string;
  capabilities: string[];
  isFavorite: boolean;
  isActive: boolean;
  order: number;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kTokens?: number;
  subtitle?: string;
}

interface ModelStore {
  selectedModelId: string | null;
  selectedModelData: ModelData | null;
  
  // Actions
  setSelectedModel: (modelId: string, modelData: ModelData) => void;
  updateSelectedModelData: (modelData: ModelData) => void;
  clearSelectedModel: () => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      selectedModelId: null,
      selectedModelData: null,

      setSelectedModel: (modelId: string, modelData: ModelData) => {
        set({
          selectedModelId: modelId,
          selectedModelData: modelData,
        });
      },

      updateSelectedModelData: (modelData: ModelData) => {
        const state = get();
        // Only update if this is the currently selected model
        if (state.selectedModelId === modelData.id) {
          set({
            selectedModelData: modelData,
          });
        }
      },

      clearSelectedModel: () => {
        set({
          selectedModelId: null,
          selectedModelData: null,
        });
      },
    }),
    {
      name: 'model-store',
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
        selectedModelData: state.selectedModelData,
      }),
    }
  )
); 