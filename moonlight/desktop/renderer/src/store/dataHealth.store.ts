import { create } from 'zustand';
import { getDataHealthMatrix } from '../services/data-api';
import { DataHealthMatrixDTO } from '../lib/types';

interface DataHealthState {
  matrix: DataHealthMatrixDTO | null;
  isLoading: boolean;
  error: string | null;
  fetchMatrix: () => Promise<void>;
}

export const useDataHealthStore = create<DataHealthState>((set) => ({
  matrix: null,
  isLoading: false,
  error: null,
  fetchMatrix: async () => {
    set({ isLoading: true, error: null });
    try {
      const matrix = await getDataHealthMatrix();
      set({ matrix, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
