import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OpenRouterState {
  useOpenRouter: boolean;
  setUseOpenRouter: (useOpenRouter: boolean) => void;
}

export const useOpenRouterStore = create<OpenRouterState>()(
  persist(
    (set) => ({
      useOpenRouter: false,
      setUseOpenRouter: (useOpenRouter: boolean) => set({ useOpenRouter }),
    }),
    {
      name: 'openrouter-mode',
    }
  )
); 