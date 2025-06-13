import { create } from 'zustand';

export type UploadStatus = 'pending' | 'validating' | 'uploading' | 'error' | 'done';

export interface UploadingFile {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number; // 0-100
  status: UploadStatus;
  error?: string;
}

interface UploadStore {
  uploads: UploadingFile[];
  addUpload: (file: Omit<UploadingFile, 'progress' | 'status'>) => string;
  updateProgress: (id: string, progress: number) => void;
  updateStatus: (id: string, status: UploadStatus) => void;
  updateError: (id: string, error: string) => void;
  removeUpload: (id: string) => void;
  clearUploads: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  addUpload: (file) => {
    const id = file.id;
    set((state) => ({
      uploads: [
        ...state.uploads,
        { ...file, progress: 0, status: 'pending' },
      ],
    }));
    return id;
  },
  updateProgress: (id, progress) => {
    set((state) => ({
      uploads: state.uploads.map((f) =>
        f.id === id ? { ...f, progress } : f
      ),
    }));
  },
  updateStatus: (id, status) => {
    set((state) => ({
      uploads: state.uploads.map((f) =>
        f.id === id ? { ...f, status } : f
      ),
    }));
  },
  updateError: (id, error) => {
    set((state) => ({
      uploads: state.uploads.map((f) =>
        f.id === id ? { ...f, status: 'error', error } : f
      ),
    }));
  },
  removeUpload: (id) => {
    set((state) => ({
      uploads: state.uploads.filter((f) => f.id !== id),
    }));
  },
  clearUploads: () => set({ uploads: [] }),
})); 