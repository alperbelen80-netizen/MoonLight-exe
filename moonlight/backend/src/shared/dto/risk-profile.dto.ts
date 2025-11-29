import { IsString, IsNumber, IsBoolean, IsISO8601, IsOptional, Min, Max } from 'class-validator';

export class RiskProfileDTO {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  max_per_trade_pct: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  max_daily_loss_pct: number;

  @IsNumber()
  @Min(1)
  max_concurrent_trades: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  max_exposure_per_symbol_pct: number;

  @IsBoolean()
  enabled: boolean;

  @IsISO8601({ strict: true })
  created_at_utc: string;

  @IsISO8601({ strict: true })
  updated_at_utc: string;
}

export type RiskViolationCode =
  | 'MAX_DAILY_LOSS'
  | 'PER_TRADE_LIMIT'
  | 'MAX_CONCURRENT_TRADES'
  | 'SYMBOL_EXPOSURE';

export class RiskGuardrailDecision {
  allowed: boolean;
  violations: RiskViolationCode[];
  effective_stake_amount: number;
}

export class RiskContextSnapshot {
  equity: number;
  open_trades_count: number;
  today_loss_abs: number;
  today_loss_pct: number;
  symbol_exposure_pct: number;
}
