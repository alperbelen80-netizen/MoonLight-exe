import { IsString, IsArray, IsNumber, IsEnum, IsObject, IsISO8601, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BacktestRunStatus } from './backtest.dto';
import { Timeframe } from '../enums/timeframe.enum';

export class OwnerBacktestRunItemDTO {
  @IsString()
  run_id: string;

  @IsEnum(BacktestRunStatus)
  status: BacktestRunStatus;

  @IsArray()
  @IsString({ each: true })
  symbols: string[];

  @IsArray()
  @IsString({ each: true })
  timeframes: string[];

  @IsArray()
  @IsString({ each: true })
  strategy_ids: string[];

  @IsString()
  from_date: string;

  @IsString()
  to_date: string;

  @IsNumber()
  net_pnl: number;

  @IsNumber()
  win_rate: number;

  @IsISO8601({ strict: true })
  created_at_utc: string;
}

export class OwnerTopStrategyItemDTO {
  @IsString()
  strategy_id: string;

  @IsNumber()
  total_trades: number;

  @IsNumber()
  win_rate: number;

  @IsNumber()
  net_pnl: number;
}

export class QueueHealthDTO {
  @IsString()
  queue_name: string;

  @IsNumber()
  waiting: number;

  @IsNumber()
  active: number;

  @IsNumber()
  completed: number;

  @IsNumber()
  failed: number;

  @IsNumber()
  delayed: number;
}

export class OwnerDashboardSummaryDTO {
  @IsObject()
  backtest_counts_by_status: Record<BacktestRunStatus, number>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerBacktestRunItemDTO)
  recent_runs: OwnerBacktestRunItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerTopStrategyItemDTO)
  top_strategies: OwnerTopStrategyItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueueHealthDTO)
  queue_health: QueueHealthDTO[];

  @IsISO8601({ strict: true })
  generated_at_utc: string;
}
