import { create } from 'zustand';
import { getDashboardSummary } from '../services/owner-api';
import { DashboardSummaryDTO } from '../lib/types';

interface DashboardState {
  summary: DashboardSummaryDTO | null;
  isLoading: boolean;
  error: string | null;
  fetchSummary: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  summary: null,
  isLoading: false,
  error: null,
  fetchSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const summary = await getDashboardSummary();
      set({ summary, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
