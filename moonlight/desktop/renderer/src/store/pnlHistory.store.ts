import { create } from 'zustand';
import { getPnlHistory, PnlRange, EnvironmentFilter } from '../services/pnl-history-api';
import { PnlHistoryDTO } from '../lib/types';

interface PnlHistoryState {
  history?: PnlHistoryDTO;
  loading: boolean;
  error?: string;
  range: PnlRange;
  environmentFilter: EnvironmentFilter;

  loadHistory: () => Promise<void>;
  setRange: (range: PnlRange) => void;
  setEnvironmentFilter: (env: EnvironmentFilter) => void;
}

export const usePnlHistoryStore = create<PnlHistoryState>((set, get) => ({
  history: undefined,
  loading: false,
  error: undefined,
  range: '30d',
  environmentFilter: 'ALL',

  loadHistory: async () => {
    set({ loading: true, error: undefined });
    try {
      const history = await getPnlHistory(get().range, get().environmentFilter);
      set({ history, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  setRange: (range) => {
    set({ range });
    get().loadHistory();
  },

  setEnvironmentFilter: (env) => {
    set({ environmentFilter: env });
    get().loadHistory();
  },
}));
