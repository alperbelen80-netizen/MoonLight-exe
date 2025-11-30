export type ExecutionMode = 'OFF' | 'AUTO' | 'GUARD' | 'ANALYSIS';
export type HealthColor = 'GREEN' | 'AMBER' | 'RED' | 'BLACKOUT';
export type CircuitBreakerLevel = 'L1_PRODUCT' | 'L2_BROKER' | 'L3_GLOBAL' | 'NONE';
export type SessionHealth = 'UP' | 'DEGRADED' | 'RECONNECTING' | 'COOLDOWN' | 'DOWN';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type SignalDirection = 'CALL' | 'PUT';
export type QualityGrade = 'A' | 'B' | 'C' | 'REJECTED';
export type Environment = 'LIVE' | 'SANDBOX';
export type HardwareProfileName = 'SAFE' | 'BALANCED' | 'MAXPOWER';

export interface ExecutionModeDTO {
  mode: ExecutionMode;
  updated_at_utc: string;
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
  fail_safe_active: boolean;
  last_fail_safe_reason?: string;
  environment: Environment;
  hardware_profile: HardwareProfileName;
  top_strategies: {
    strategy_id: string;
    wr: number;
    trades: number;
    net_pnl: number;
    health_score: number;
  }[];
  top_symbols: {
    symbol: string;
    tf: string;
    wr: number;
    trades: number;
    net_pnl: number;
    health_score: number;
  }[];
  generated_at_utc: string;
}

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

export interface ExecutionMatrixRowDTO {
  id: string;
  symbol: string;
  tf: string;
  data_enabled: boolean;
  signal_enabled: boolean;
  auto_trade_enabled: boolean;
  updated_at_utc: string;
}

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

export interface ApprovalItemDTO {
  id: string;
  trade_uid: string;
  signal_id: string;
  account_id: string;
  status: string;
  m3_uncertainty_score: number;
  m3_uncertainty_level: string;
  created_at_utc: string;
}

export interface CreateAccountDTO {
  alias: string;
  broker_id: string;
  type: string;
}

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

export interface PackStatsDTO {
  total_trades: number;
  selected_by_pack_count: number;
  rejected_by_gating_count: number;
  avg_selected_ev: number | null;
  avg_rejected_ev: number | null;
  last_updated_utc: string;
}

export interface ExecutionHealthDTO {
  last_hour_trades: number;
  last_day_trades: number;
  win_rate_last_hour: number | null;
  win_rate_last_day: number | null;
  blocked_by_risk_count_last_day: number;
  blocked_by_ev_count_last_day: number;
  blocked_by_hw_profile_last_day: number;
  last_updated_utc: string;
}
