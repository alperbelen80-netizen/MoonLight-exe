import { create } from 'zustand';
import { getAccounts, createAccount } from '../services/owner-api';
import { AccountDTO, CreateAccountDTO } from '../lib/types';

interface AccountsState {
  accounts: AccountDTO[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  createError: string | null;
  fetchAccounts: () => Promise<void>;
  createNewAccount: (payload: CreateAccountDTO) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,
  isCreating: false,
  createError: null,
  fetchAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await getAccounts();
      set({ accounts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  createNewAccount: async (payload) => {
    set({ isCreating: true, createError: null });
    try {
      await createAccount(payload);
      set({ isCreating: false });
      await get().fetchAccounts();
    } catch (error: any) {
      set({ createError: error.message, isCreating: false });
    }
  },
}));
