import {
  IsString,
  IsEnum,
  IsNumber,
  IsISO8601,
  Min,
  Max,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export enum SignalDirection {
  CALL = 'CALL',
  PUT = 'PUT',
}

export enum UncertaintyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum Environment {
  LIVE = 'LIVE',
  SANDBOX = 'SANDBOX',
  BACKTEST = 'BACKTEST',
}

export class CanonicalSignalDTO {
  @IsString()
  @Matches(/^SIG_/, { message: 'signal_id must start with SIG_' })
  signal_id: string;

  @IsString()
  idempotency_key: string;

  @IsString()
  source: string;

  @IsString()
  @IsOptional()
  strategy_id?: string;

  @IsString()
  @Matches(/^[A-Z]{3,10}$/, { message: 'symbol must be uppercase, 3-10 chars' })
  symbol: string;

  @IsString()
  @IsIn(['1s', '3s', '5s', '15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h', '1d'], {
    message: 'tf must be valid timeframe code',
  })
  tf: string;

  @IsISO8601({ strict: true }, { message: 'ts must be ISO 8601 UTC format' })
  ts: string;

  @IsEnum(SignalDirection)
  direction: SignalDirection;

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  ev: number;

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  confidence_score: number;

  @IsISO8601({ strict: true })
  valid_until: string;

  @IsNumber()
  @Min(0)
  latency_budget_ms: number;

  @IsEnum(UncertaintyLevel)
  @IsOptional()
  uncertainty_level?: UncertaintyLevel;

  @IsNumber()
  @Min(0)
  @IsOptional()
  requested_stake?: number;

  @IsNumber()
  @Min(1)
  schema_version: number;

  @IsEnum(Environment)
  environment: Environment;
}
