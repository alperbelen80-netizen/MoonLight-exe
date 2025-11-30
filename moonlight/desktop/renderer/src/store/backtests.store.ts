import { create } from 'zustand';
import {
  getBacktestRuns,
  getBacktestRun,
  updateBacktestTags,
  updateBacktestNotes,
  updateBacktestFavorite,
  BacktestRunsQuery,
  BacktestRunSummaryDTO,
} from '../services/backtest-api';

interface BacktestsFilters {
  symbol?: string;
  timeframe?: string;
  strategyCode?: string;
  environment?: string;
  hardwareProfile?: string;
  from?: string;
  to?: string;
  minWinRate?: number;
  maxWinRate?: number;
  minNetPnl?: number;
  maxNetPnl?: number;
  tag?: string;
  isFavorite?: boolean;
}

interface BacktestsState {
  items: BacktestRunSummaryDTO[];
  page: number;
  pageSize: number;
  total: number;
  filters: BacktestsFilters;
  loading: boolean;
  error?: string;
  selectedRunId?: string;

  loadRuns: () => Promise<void>;
  setFilter: (partial: Partial<BacktestsFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  selectRun: (id?: string) => void;
  toggleFavorite: (id: string) => Promise<void>;
  updateTags: (id: string, tags: string[]) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
}

export const useBacktestsStore = create<BacktestsState>((set, get) => ({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  filters: {},
  loading: false,
  selectedRunId: undefined,

  loadRuns: async () => {
    set({ loading: true, error: undefined });
    try {
      const query: BacktestRunsQuery = {
        page: get().page,
        pageSize: get().pageSize,
        ...get().filters,
      };

      const response = await getBacktestRuns(query);

      set({
        items: response.items,
        total: response.total,
        loading: false,
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  setFilter: (partial) => {
    set({ filters: { ...get().filters, ...partial }, page: 1 });
    get().loadRuns();
  },

  resetFilters: () => {
    set({ filters: {}, page: 1 });
    get().loadRuns();
  },

  setPage: (page) => {
    set({ page });
    get().loadRuns();
  },

  selectRun: (id) => {
    set({ selectedRunId: id });
  },

  toggleFavorite: async (id) => {
    const run = get().items.find((r) => r.run_id === id);
    if (!run) return;

    const newFavorite = !run.is_favorite;

    set({
      items: get().items.map((r) =>
        r.run_id === id ? { ...r, is_favorite: newFavorite } : r,
      ),
    });

    try {
      await updateBacktestFavorite(id, newFavorite);
    } catch (error: any) {
      set({
        items: get().items.map((r) =>
          r.run_id === id ? { ...r, is_favorite: !newFavorite } : r,
        ),
      });
      set({ error: error.message });
    }
  },

  updateTags: async (id, tags) => {
    try {
      await updateBacktestTags(id, tags);

      set({
        items: get().items.map((r) =>
          r.run_id === id ? { ...r, tags } : r,
        ),
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateNotes: async (id, notes) => {
    try {
      await updateBacktestNotes(id, notes);

      set({
        items: get().items.map((r) =>
          r.run_id === id ? { ...r, notes } : r,
        ),
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
