import { IsNumber, IsString, IsEnum, IsArray, IsISO8601, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionMode } from '../enums/execution-mode.enum';
import { CircuitBreakerLevel } from '../enums/circuit-breaker-level.enum';

export enum HealthColor {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED',
  BLACKOUT = 'BLACKOUT',
}

export class TopStrategyItemDTO {
  strategy_id: string;
  wr: number;
  trades: number;
  net_pnl: number;
  health_score: number;
}

export class TopSymbolItemDTO {
  symbol: string;
  tf: string;
  wr: number;
  trades: number;
  net_pnl: number;
  health_score: number;
}

export class OwnerDashboardSummaryDTO {
  @IsNumber()
  global_health_score: number;

  @IsEnum(HealthColor)
  global_health_color: HealthColor;

  @IsNumber()
  daily_net_pnl: number;

  @IsNumber()
  daily_trade_count: number;

  @IsNumber()
  monthly_net_pnl: number;

  @IsNumber()
  live_win_rate_7d: number;

  @IsNumber()
  live_trade_count_7d: number;

  @IsEnum(ExecutionMode)
  execution_mode: ExecutionMode;

  @IsString()
  circuit_breaker_level: string;

  @IsNumber()
  approval_queue_pending_count: number;

  @IsOptional()
  fail_safe_active?: boolean;

  @IsString()
  @IsOptional()
  last_fail_safe_reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopStrategyItemDTO)
  top_strategies: TopStrategyItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopSymbolItemDTO)
  top_symbols: TopSymbolItemDTO[];

  @IsISO8601({ strict: true })
  generated_at_utc: string;
}
