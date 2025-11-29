import { IsString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CanonicalSignalDTO } from './canonical-signal.dto';

export class OpenTradeDTO {
  @IsString()
  trade_uid: string;

  @IsString()
  symbol: string;

  @IsString()
  tf: string;

  @IsString()
  direction: string;

  @IsString()
  expiry_slot_minutes: number;

  @IsString()
  cluster: string;
}

export class ConflictCheckRequest {
  @ValidateNested()
  @Type(() => CanonicalSignalDTO)
  new_signal: CanonicalSignalDTO;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenTradeDTO)
  open_trades: OpenTradeDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenTradeDTO)
  scheduled_trades: OpenTradeDTO[];
}

export enum ConflictDecision {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
}

export class ConflictCheckResult {
  decision: ConflictDecision;
  reason_codes: string[];
  metadata?: Record<string, any>;
}
