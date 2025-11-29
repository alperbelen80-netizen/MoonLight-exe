import { create } from 'zustand';
import {
  getExecutionMatrix,
  updateExecutionMatrixRow,
} from '../services/owner-api';
import { ExecutionMatrixRowDTO } from '../lib/types';

interface MatrixState {
  rows: ExecutionMatrixRowDTO[];
  isLoading: boolean;
  error: string | null;
  isUpdatingRowId: string | null;
  fetchMatrix: () => Promise<void>;
  toggleFlag: (
    rowId: string,
    flagName: 'data_enabled' | 'signal_enabled' | 'auto_trade_enabled',
  ) => Promise<void>;
}

export const useMatrixStore = create<MatrixState>((set, get) => ({
  rows: [],
  isLoading: false,
  error: null,
  isUpdatingRowId: null,
  fetchMatrix: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await getExecutionMatrix();
      set({ rows, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  toggleFlag: async (rowId, flagName) => {
    const row = get().rows.find((r) => r.id === rowId);
    if (!row) return;

    const newValue = !row[flagName];

    set({ isUpdatingRowId: rowId });

    set({
      rows: get().rows.map((r) =>
        r.id === rowId ? { ...r, [flagName]: newValue } : r,
      ),
    });

    try {
      await updateExecutionMatrixRow(rowId, { [flagName]: newValue });
      set({ isUpdatingRowId: null });
    } catch (error: any) {
      set({
        rows: get().rows.map((r) =>
          r.id === rowId ? { ...r, [flagName]: !newValue } : r,
        ),
        isUpdatingRowId: null,
      });
    }
  },
}));
