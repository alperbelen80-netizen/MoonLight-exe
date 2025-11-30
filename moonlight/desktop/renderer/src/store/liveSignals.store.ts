import { create } from 'zustand';
import {
  fetchLiveSignals,
  updateLiveSignalStatus,
  LiveSignalDTO,
  LiveSignalsQuery,
} from '../services/live-signal-api';

interface LiveSignalsFilters {
  symbol?: string;
  timeframe?: string;
  status: string;
  dateRange: 'last_1h' | 'last_4h' | 'last_24h' | 'custom';
  from?: string;
  to?: string;
  strategyFamily?: string;
  confidenceMin?: number;
  confidenceMax?: number;
}

interface LiveSignalsState {
  items: LiveSignalDTO[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error?: string;
  filters: LiveSignalsFilters;
  selectedSignalId?: string;

  loadSignals: () => Promise<void>;
  setFilter: (partial: Partial<LiveSignalsFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  selectSignal: (id?: string) => void;
  updateStatus: (id: string, status: string, notes?: string) => Promise<void>;
}

const defaultFilters: LiveSignalsFilters = {
  status: 'ALL',
  dateRange: 'last_24h',
};

export const useLiveSignalsStore = create<LiveSignalsState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 50,
  loading: false,
  filters: defaultFilters,
  selectedSignalId: undefined,

  loadSignals: async () => {
    set({ loading: true, error: undefined });
    try {
      const { filters, page, pageSize } = get();

      const query: LiveSignalsQuery = {
        page,
        pageSize,
        symbol: filters.symbol,
        timeframe: filters.timeframe,
        status: filters.status === 'ALL' ? undefined : filters.status,
        strategyFamily: filters.strategyFamily,
        confidenceMin: filters.confidenceMin,
        confidenceMax: filters.confidenceMax,
      };

      if (filters.dateRange !== 'custom') {
        query.range = filters.dateRange;
      } else {
        query.from = filters.from;
        query.to = filters.to;
      }

      const response = await fetchLiveSignals(query);

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
    get().loadSignals();
  },

  resetFilters: () => {
    set({ filters: defaultFilters, page: 1 });
    get().loadSignals();
  },

  setPage: (page) => {
    set({ page });
    get().loadSignals();
  },

  selectSignal: (id) => {
    set({ selectedSignalId: id });
  },

  updateStatus: async (id, status, notes) => {
    const originalItem = get().items.find((s) => s.id === id);
    if (!originalItem) return;

    set({
      items: get().items.map((s) =>
        s.id === id ? { ...s, status: status as any, notes: notes || s.notes } : s,
      ),
    });

    try {
      await updateLiveSignalStatus(id, status, notes);
    } catch (error: any) {
      set({
        items: get().items.map((s) =>
          s.id === id
            ? { ...s, status: originalItem.status, notes: originalItem.notes }
            : s,
        ),
      });
      set({ error: error.message });
    }
  },
}));
