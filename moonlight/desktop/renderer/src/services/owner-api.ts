import { apiGet } from './api-client';
import {
  DashboardSummaryDTO,
  AccountDTO,
  CreateAccountDTO,
  ExecutionMatrixRowDTO,
  ExecutionModeDTO,
  ExecutionMode,
  PackStatsDTO,
  ExecutionHealthDTO,
} from '../lib/types';

export async function getDashboardSummary(): Promise<DashboardSummaryDTO> {
  return apiGet<DashboardSummaryDTO>('/owner/dashboard/summary');
}

export async function getPackStats(): Promise<PackStatsDTO> {
  return apiGet<PackStatsDTO>('/owner/dashboard/pack-stats');
}

export async function getExecutionHealth(): Promise<ExecutionHealthDTO> {
  return apiGet<ExecutionHealthDTO>('/owner/dashboard/execution-health');
}

export async function getAccounts(): Promise<AccountDTO[]> {
  return apiGet<AccountDTO[]>('/owner/accounts');
}

export async function createAccount(
  payload: CreateAccountDTO,
): Promise<AccountDTO> {
  return apiPost<AccountDTO>('/owner/accounts', payload);
}

export async function getExecutionMatrix(): Promise<ExecutionMatrixRowDTO[]> {
  return apiGet<ExecutionMatrixRowDTO[]>('/owner/execution-matrix');
}

export async function updateExecutionMatrixRow(
  id: string,
  patch: Partial<ExecutionMatrixRowDTO>,
): Promise<ExecutionMatrixRowDTO> {
  return apiPatch<ExecutionMatrixRowDTO>(
    `/owner/execution-matrix/${id}`,
    patch,
  );
}

export async function getExecutionMode(): Promise<ExecutionModeDTO> {
  return apiGet<ExecutionModeDTO>('/owner/execution-mode');
}

export async function setExecutionMode(
  mode: ExecutionMode,
): Promise<ExecutionModeDTO> {
  return apiPost<ExecutionModeDTO>('/owner/execution-mode', { mode });
}

import { apiPost, apiPatch } from './api-client';
