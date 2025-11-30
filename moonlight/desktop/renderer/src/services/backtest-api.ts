import { apiGet, apiPost } from './api-client';

export interface BacktestRunsQuery {
  page?: number;
  pageSize?: number;
  symbol?: string;
  timeframe?: string;
  strategyCode?: string;
  environment?: string;
  hardwareProfile?: string;
  from?: string;
  to?: string;
  minWinRate?: number;
  maxWinRate?: number;
  minNetPnl?: number;
  maxNetPnl?: number;
  tag?: string;
  isFavorite?: boolean;
}

export interface BacktestRunSummaryDTO {
  run_id: string;
  status: string;
  symbols: string[];
  timeframes: string[];
  strategy_ids: string[];
  from_date: string;
  to_date: string;
  total_trades: number;
  win_rate: number;
  net_pnl: number;
  max_drawdown: number;
  sharpe?: number;
  profit_factor?: number;
  expectancy?: number;
  tags?: string[];
  notes?: string;
  is_favorite: boolean;
  environment: string;
  hardware_profile: string;
  created_at_utc: string;
  updated_at_utc: string;
  completed_at_utc?: string;
}

export interface BacktestRunListResponse {
  items: BacktestRunSummaryDTO[];
  page: number;
  page_size: number;
  total: number;
}

export async function getBacktestRuns(
  query: BacktestRunsQuery,
): Promise<BacktestRunListResponse> {
  const params = new URLSearchParams();

  if (query.page) params.append('page', query.page.toString());
  if (query.pageSize) params.append('pageSize', query.pageSize.toString());
  if (query.symbol) params.append('symbol', query.symbol);
  if (query.timeframe) params.append('timeframe', query.timeframe);
  if (query.strategyCode) params.append('strategyCode', query.strategyCode);
  if (query.environment) params.append('environment', query.environment);
  if (query.hardwareProfile) params.append('hardwareProfile', query.hardwareProfile);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);
  if (query.minWinRate !== undefined) params.append('minWinRate', query.minWinRate.toString());
  if (query.maxWinRate !== undefined) params.append('maxWinRate', query.maxWinRate.toString());
  if (query.minNetPnl !== undefined) params.append('minNetPnl', query.minNetPnl.toString());
  if (query.maxNetPnl !== undefined) params.append('maxNetPnl', query.maxNetPnl.toString());
  if (query.tag) params.append('tag', query.tag);
  if (query.isFavorite !== undefined) params.append('isFavorite', query.isFavorite.toString());

  const path = `/backtest/runs${params.toString() ? `?${params.toString()}` : ''}`;
  return apiGet<BacktestRunListResponse>(path);
}

export async function getBacktestRun(id: string): Promise<BacktestRunSummaryDTO> {
  return apiGet<BacktestRunSummaryDTO>(`/backtest/runs/${id}`);
}

export async function updateBacktestTags(id: string, tags: string[]): Promise<void> {
  await apiPost(`/backtest/runs/${id}/tags`, { tags });
}

export async function updateBacktestNotes(id: string, notes: string): Promise<void> {
  await apiPost(`/backtest/runs/${id}/notes`, { notes });
}

export async function updateBacktestFavorite(id: string, isFavorite: boolean): Promise<void> {
  await apiPost(`/backtest/runs/${id}/favorite`, { is_favorite: isFavorite });
}
