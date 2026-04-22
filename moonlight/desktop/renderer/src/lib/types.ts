// ============================================================
// MoonLight Desktop Type Definitions
// Mirrors backend DTOs in src/shared/dto/
// ============================================================

// ---------- PNL History ----------
export interface DailyPnlPoint {
  date: string;
  environment: 'LIVE' | 'SANDBOX';
  trades: number;
  wins: number;
  losses: number;
  blocked_by_risk: number;
  blocked_by_ev: number;
  blocked_by_hw_profile: number;
  net_pnl: number;
}

export interface PnlHistoryDTO {
  points: DailyPnlPoint[];
  range: string;
  generated_at_utc: string;
}

// ---------- Enums ----------
export type ExecutionMode = 'OFF' | 'AUTO' | 'GUARD' | 'ANALYSIS';

export type SessionHealth =
  | 'UP'
  | 'DEGRADED'
  | 'RECONNECTING'
  | 'COOLDOWN'
  | 'DOWN';

export type HealthColor = 'GREEN' | 'AMBER' | 'RED' | 'BLACKOUT';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type CircuitBreakerLevel = 'NONE' | 'L1_CAUTION' | 'L2_DEGRADED' | 'L3_GLOBAL';

// ---------- Execution Mode ----------
export interface ExecutionModeDTO {
  mode: ExecutionMode;
  updated_at_utc: string;
}

// ---------- Accounts ----------
export interface AccountDTO {
  account_id: string;
  broker_id: string;
  alias: string;
  type: string;
  status: string;
  session_health: SessionHealth;
  balance?: number;
  created_at_utc: string;
}

export interface CreateAccountDTO {
  broker_id: string;
  alias: string;
  type: string;
  credentials?: Record<string, string>;
}

// ---------- Alerts ----------
export interface AlertDTO {
  alert_id: string;
  source: string;
  severity: AlertSeverity;
  category: string;
  message: string;
  details?: string;
  status: AlertStatus;
  auto_action?: string;
  owner_action?: string;
  created_at_utc: string;
  resolved_at_utc?: string;
  runbook_link?: string;
}

// ---------- Execution Matrix ----------
export interface ExecutionMatrixRowDTO {
  id: string;
  symbol: string;
  tf: string;
  data_enabled: boolean;
  signal_enabled: boolean;
  auto_trade_enabled: boolean;
  updated_at_utc: string;
}

// ---------- Dashboard Summary ----------
export interface TopStrategyItem {
  strategy_id: string;
  wr: number;
  trades: number;
  net_pnl: number;
  health_score: number;
}

export interface TopSymbolItem {
  symbol: string;
  tf: string;
  wr: number;
  trades: number;
  net_pnl: number;
  health_score: number;
}

export interface DashboardSummaryDTO {
  global_health_score: number;
  global_health_color: HealthColor;
  daily_net_pnl: number;
  daily_trade_count: number;
  monthly_net_pnl: number;
  live_win_rate_7d: number;
  live_trade_count_7d: number;
  execution_mode: ExecutionMode;
  circuit_breaker_level: string;
  approval_queue_pending_count: number;
  fail_safe_active?: boolean;
  last_fail_safe_reason?: string;
  top_strategies: TopStrategyItem[];
  top_symbols: TopSymbolItem[];
  environment: string;
  hardware_profile: string;
  generated_at_utc: string;
}

// ---------- Pack Stats ----------
export interface PackStatsItem {
  pack_id: string;
  name: string;
  strategy_count: number;
  active_count: number;
  avg_wr: number;
  total_trades_7d: number;
  net_pnl_7d: number;
}

export interface PackStatsDTO {
  items: PackStatsItem[];
  generated_at_utc: string;
}

// ---------- Execution Health ----------
export interface ExecutionHealthDTO {
  queue_depth: number;
  avg_latency_ms: number;
  error_rate: number;
  reconciliation_backlog: number;
  fsm_stuck_count: number;
  last_order_ts_utc?: string;
  generated_at_utc: string;
}

// ---------- Data Health Matrix ----------
export type QualityGrade = 'A' | 'B' | 'C' | 'REJECTED';

export interface DataHealthItemDTO {
  symbol: string;
  tf: string;
  coverage_pct: number;
  gap_pct: number;
  quality_grade: QualityGrade;
}

export interface DataHealthMatrixDTO {
  items: DataHealthItemDTO[];
  generated_at_utc: string;
}

// ---------- Approval Queue (M3) ----------
export type M3UncertaintyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ApprovalItemDTO {
  id: string;
  trade_uid: string;
  m3_uncertainty_level: M3UncertaintyLevel;
  m3_uncertainty_score: number;
  signal_snapshot?: unknown;
  expires_at_utc: string;
  created_at_utc: string;
}
