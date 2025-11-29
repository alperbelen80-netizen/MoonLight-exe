import { create } from 'zustand';
import { getAlerts, ackAlert, resolveAlert } from '../services/alerts-api';
import { AlertDTO, AlertSeverity, AlertStatus } from '../lib/types';

interface AlertsState {
  alerts: AlertDTO[];
  isLoading: boolean;
  error: string | null;
  filters: {
    severity?: AlertSeverity;
    status?: AlertStatus;
  };
  setFilters: (filters: { severity?: AlertSeverity; status?: AlertStatus }) => void;
  fetchAlerts: () => Promise<void>;
  ackAlertById: (id: string) => Promise<void>;
  resolveAlertById: (id: string) => Promise<void>;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  isLoading: false,
  error: null,
  filters: {},
  setFilters: (filters) => {
    set({ filters });
    get().fetchAlerts();
  },
  fetchAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      const alerts = await getAlerts(get().filters);
      set({ alerts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  ackAlertById: async (id) => {
    try {
      await ackAlert(id);
      await get().fetchAlerts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },
  resolveAlertById: async (id) => {
    try {
      await resolveAlert(id);
      await get().fetchAlerts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
