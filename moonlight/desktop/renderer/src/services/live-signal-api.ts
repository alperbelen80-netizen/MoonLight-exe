import { apiGet, apiPost } from './api-client';

export interface LiveSignalDTO {
  id: string;
  timestamp_utc: string;
  symbol: string;
  timeframe: string;
  direction: 'CALL' | 'PUT' | 'BUY' | 'SELL';
  signal_horizon: number;
  strategy_family: string;
  confidence_score: number;
  expected_wr_band_min?: number;
  expected_wr_band_max?: number;
  environment: string;
  status: 'NEW' | 'MARKED_EXECUTED' | 'SKIPPED' | 'EXPIRED' | 'WATCHING';
  notes?: string;
  entry_price?: number;
  current_price?: number;
}

export interface LiveSignalsQuery {
  page?: number;
  pageSize?: number;
  symbol?: string;
  timeframe?: string;
  from?: string;
  to?: string;
  status?: string;
  strategyFamily?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  range?: 'last_1h' | 'last_4h' | 'last_24h';
}

export interface LiveSignalsListResponse {
  items: LiveSignalDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ExecutionResult {
  signalId: string;
  success: boolean;
  brokerOrderId?: string;
  error?: string;
}

export async function fetchLiveSignals(
  query: LiveSignalsQuery,
): Promise<LiveSignalsListResponse> {
  const params = new URLSearchParams();

  if (query.page) params.append('page', query.page.toString());
  if (query.pageSize) params.append('pageSize', query.pageSize.toString());
  if (query.symbol) params.append('symbol', query.symbol);
  if (query.timeframe) params.append('timeframe', query.timeframe);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);
  if (query.status) params.append('status', query.status);
  if (query.strategyFamily) params.append('strategyFamily', query.strategyFamily);
  if (query.confidenceMin !== undefined)
    params.append('confidenceMin', query.confidenceMin.toString());
  if (query.confidenceMax !== undefined)
    params.append('confidenceMax', query.confidenceMax.toString());
  if (query.range) params.append('range', query.range);

  const path = `/live/signals${params.toString() ? `?${params.toString()}` : ''}`;
  return apiGet<LiveSignalsListResponse>(path);
}

export async function updateLiveSignalStatus(
  id: string,
  status: string,
  notes?: string,
): Promise<void> {
  await apiPost(`/live/signals/${id}/status`, { status, notes });
}

export async function executeApprovedSignal(
  id: string,
  accountId: string,
): Promise<ExecutionResult> {
  return apiPost<ExecutionResult>(`/live/signals/${id}/execute`, {
    account_id: accountId,
  });
}
