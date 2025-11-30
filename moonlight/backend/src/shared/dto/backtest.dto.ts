import { IsString, IsArray, IsEnum, IsNumber, IsOptional, Min, Matches, IsBoolean, IsISO8601 } from 'class-validator';
import { Timeframe } from '../enums/timeframe.enum';
import { Environment } from './canonical-signal.dto';

export enum BacktestRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class BacktestRunRequestDTO {
  @IsArray()
  @IsString({ each: true })
  symbols: string[];

  @IsArray()
  @IsEnum(Timeframe, { each: true })
  timeframes: Timeframe[];

  @IsArray()
  @IsString({ each: true })
  strategy_ids: string[];

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from_date: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to_date: string;

  @IsNumber()
  @Min(0)
  initial_balance: number;

  @IsString()
  risk_profile_id: string;

  @IsEnum(Environment)
  environment: Environment;

  @IsString()
  @IsOptional()
  note?: string;
}

export class BacktestRunSummaryDTO {
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
  total_trades: number;

  @IsNumber()
  win_rate: number;

  @IsNumber()
  net_pnl: number;

  @IsNumber()
  max_drawdown: number;

  @IsNumber()
  @IsOptional()
  sharpe?: number;

  @IsNumber()
  @IsOptional()
  profit_factor?: number;

  @IsNumber()
  @IsOptional()
  expectancy?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  is_favorite: boolean;

  @IsString()
  environment: string;

  @IsString()
  hardware_profile: string;

  @IsNumber()
  @IsOptional()
  blocked_by_risk_count?: number;

  @IsNumber()
  @IsOptional()
  cancelled_trades_count?: number;

  @IsISO8601({ strict: true })
  created_at_utc: string;

  @IsISO8601({ strict: true })
  updated_at_utc: string;

  @IsISO8601({ strict: true })
  @IsOptional()
  completed_at_utc?: string;
}

export class BacktestRunListResponse {
  items: BacktestRunSummaryDTO[];
  page: number;
  page_size: number;
  total: number;
}

export class BacktestRunDetailDTO {
  summary: BacktestRunSummaryDTO;
  trades_sample: any[];
}
