import { IsString, IsEnum, IsISO8601, IsArray, ValidateNested, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { Timeframe } from '../enums/timeframe.enum';
import { OhlcvBarDTO } from './ohlcv-bar.dto';
import { Environment } from './canonical-signal.dto';

export class StrategyContext {
  @IsString()
  symbol: string;

  @IsEnum(Timeframe)
  tf: Timeframe;

  @IsISO8601({ strict: true })
  now_ts_utc: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OhlcvBarDTO)
  bars: OhlcvBarDTO[];

  @IsEnum(Environment)
  environment: Environment;

  @IsObject()
  @IsOptional()
  extra?: Record<string, unknown>;
}

export class StrategyEvaluationOptions {
  @IsOptional()
  max_signals_per_context?: number;

  @IsOptional()
  min_ev?: number;

  @IsOptional()
  min_confidence?: number;
}
