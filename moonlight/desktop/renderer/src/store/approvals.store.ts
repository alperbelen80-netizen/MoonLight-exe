import { create } from 'zustand';
import {
  getPendingApprovals,
  approveTrade,
  rejectTrade,
} from '../services/risk-api';
import { ApprovalItemDTO } from '../lib/types';

interface ApprovalsState {
  pending: ApprovalItemDTO[];
  isLoading: boolean;
  error: string | null;
  processingId: string | null;
  fetchPending: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  pending: [],
  isLoading: false,
  error: null,
  processingId: null,
  fetchPending: async () => {
    set({ isLoading: true, error: null });
    try {
      const pending = await getPendingApprovals();
      set({ pending, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  approve: async (id) => {
    set({ processingId: id });
    try {
      await approveTrade(id);
      set({ processingId: null });
      await get().fetchPending();
    } catch (error: any) {
      set({ error: error.message, processingId: null });
    }
  },
  reject: async (id, reason) => {
    set({ processingId: id });
    try {
      await rejectTrade(id, reason);
      set({ processingId: null });
      await get().fetchPending();
    } catch (error: any) {
      set({ error: error.message, processingId: null });
    }
  },
}));
