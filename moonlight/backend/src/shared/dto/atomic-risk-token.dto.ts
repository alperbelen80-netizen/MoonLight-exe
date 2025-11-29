import {
  IsString,
  IsEnum,
  IsNumber,
  IsISO8601,
  Min,
  IsArray,
  IsOptional,
} from 'class-validator';
import { SignalDirection } from './canonical-signal.dto';

export enum ARTDecision {
  ACCEPT = 'ACCEPT',
  SCALE_DOWN = 'SCALE_DOWN',
  REJECT = 'REJECT',
}

export enum VolatilityRegime {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class AtomicRiskTokenDTO {
  @IsString()
  art_id: string;

  @IsString()
  signal_id: string;

  @IsString()
  user_id: string;

  @IsString()
  account_id: string;

  @IsString()
  profile_id: string;

  @IsString()
  product: string;

  @IsEnum(SignalDirection)
  direction: SignalDirection;

  @IsEnum(ARTDecision)
  decision: ARTDecision;

  @IsNumber()
  @Min(0)
  approved_stake: number;

  @IsNumber()
  @Min(0)
  max_risk_amount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_slippage?: number;

  @IsNumber()
  @IsOptional()
  session_drawdown_before?: number;

  @IsNumber()
  @IsOptional()
  session_drawdown_after?: number;

  @IsEnum(VolatilityRegime)
  @IsOptional()
  volatility_regime?: VolatilityRegime;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reason_codes?: string[];

  @IsISO8601({ strict: true })
  expires_at: string;

  @IsISO8601({ strict: true })
  created_at: string;

  @IsString()
  signature: string;
}
