import { apiGet, apiPost } from './api-client';
import { ApprovalItemDTO } from '../lib/types';

export async function activateKillSwitch(
  reason?: string,
): Promise<void> {
  await apiPost('/risk/kill-switch/activate', { reason: reason || 'MANUAL_KILL_SWITCH' });
}

export async function deactivateKillSwitch(): Promise<void> {
  await apiPost('/risk/kill-switch/deactivate');
}

export async function getPendingApprovals(): Promise<ApprovalItemDTO[]> {
  return apiGet<ApprovalItemDTO[]>('/risk/approval/pending');
}

export async function approveTrade(id: string): Promise<void> {
  await apiPost(`/risk/approval/${id}/approve`, { decided_by: 'owner@console' });
}

export async function rejectTrade(
  id: string,
  reason?: string,
): Promise<void> {
  await apiPost(`/risk/approval/${id}/reject`, { decided_by: 'owner@console' });
}
