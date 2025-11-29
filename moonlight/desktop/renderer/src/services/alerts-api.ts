import { apiGet, apiPost } from './api-client';
import { AlertDTO, AlertSeverity, AlertStatus } from '../lib/types';

export async function getAlerts(params?: {
  severity?: AlertSeverity;
  status?: AlertStatus;
  limit?: number;
}): Promise<AlertDTO[]> {
  const query = new URLSearchParams();

  if (params?.severity) {
    query.append('severity', params.severity);
  }

  if (params?.status) {
    query.append('status', params.status);
  }

  if (params?.limit) {
    query.append('limit', params.limit.toString());
  }

  const path = `/alerts${query.toString() ? `?${query.toString()}` : ''}`;
  return apiGet<AlertDTO[]>(path);
}

export async function ackAlert(id: string): Promise<void> {
  await apiPost(`/alerts/${id}/ack`);
}

export async function resolveAlert(id: string): Promise<void> {
  await apiPost(`/alerts/${id}/resolve`);
}
