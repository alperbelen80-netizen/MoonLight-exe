import { IsString, IsEnum, IsOptional, IsNumber, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CanonicalSignalDTO, Environment } from './canonical-signal.dto';

export class ExecutionRequestDTO {
  @ValidateNested()
  @Type(() => CanonicalSignalDTO)
  signal: CanonicalSignalDTO;

  @IsString()
  @IsOptional()
  risk_profile_id?: string;

  @IsEnum(Environment)
  environment: Environment;

  @IsString()
  account_id: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  requested_stake?: number;

  @IsString()
  @IsOptional()
  correlation_id?: string;
}

export class ExecutionStartResultDTO {
  @IsString()
  trade_uid: string;

  @IsString()
  current_state: string;

  @IsOptional()
  art_decision?: any;

  @IsOptional()
  m3_decision?: any;

  @IsOptional()
  human_approval_required?: boolean;
}
