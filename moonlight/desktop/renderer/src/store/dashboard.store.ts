import { create } from 'zustand';
import { DashboardSummaryDTO } from '../lib/types';
import { getDashboardSummary } from '../services/owner-api';

interface DashboardState {
  summary: DashboardSummaryDTO | null;
  isLoading: boolean;
  error: string | null;
  fetchSummary: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  isLoading: false,
  error: null,
  fetchSummary: async () => {
    // Guard against concurrent invocations (StrictMode double-mount,
    // interval firing while a previous fetch is still in flight, etc).
    if (get().isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const summary = await getDashboardSummary();
      set({ summary, isLoading: false, error: null });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
