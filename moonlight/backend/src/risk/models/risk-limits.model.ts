export interface RiskLimitsConfig {
  config_id: string;
  profile_id: string;
  
  daily_loss_limit_usd: number;
  max_drawdown_pct: number;
  
  max_lot_per_symbol_usd: number;
  max_concurrent_trades: number;
  
  cluster_exposure_limits: Record<string, number>;
  
  min_strategy_wr: number;
  min_strategy_ev: number;
  min_trade_count: number;
  
  loss_streak_limit: number;
  cooldown_period_minutes: number;
  
  created_at_utc: string;
  updated_at_utc: string;
  version: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimitsConfig = {
  config_id: 'RISK_CONFIG_DEFAULT',
  profile_id: 'PROFILE_BALANCED',
  daily_loss_limit_usd: 500,
  max_drawdown_pct: 15,
  max_lot_per_symbol_usd: 50,
  max_concurrent_trades: 5,
  cluster_exposure_limits: {
    METAL: 200,
    FX_MAJOR: 300,
    CRYPTO: 150,
  },
  min_strategy_wr: 0.6,
  min_strategy_ev: 0.02,
  min_trade_count: 50,
  loss_streak_limit: 5,
  cooldown_period_minutes: 30,
  created_at_utc: new Date().toISOString(),
  updated_at_utc: new Date().toISOString(),
  version: 1,
};
