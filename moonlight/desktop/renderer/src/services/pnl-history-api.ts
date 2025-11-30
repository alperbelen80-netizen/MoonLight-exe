import { apiGet } from './api-client';
import { PnlHistoryDTO } from '../lib/types';

export type PnlRange = '7d' | '30d' | '90d';
export type EnvironmentFilter = 'LIVE' | 'SANDBOX' | 'ALL';

export async function getPnlHistory(
  range: PnlRange = '30d',
  environment: EnvironmentFilter = 'ALL',
): Promise<PnlHistoryDTO> {
  const params = new URLSearchParams();
  params.append('range', range);
  if (environment !== 'ALL') {
    params.append('environment', environment);
  }

  return apiGet<PnlHistoryDTO>(`/owner/history/pnl?${params.toString()}`);
}
