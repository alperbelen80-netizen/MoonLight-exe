import { IsString, IsEnum, IsISO8601, IsOptional, IsNumber } from 'class-validator';
import { SessionHealth } from '../enums/session-health.enum';

export class OwnerAccountDTO {
  @IsString()
  account_id: string;

  @IsString()
  broker_id: string;

  @IsString()
  alias: string;

  @IsString()
  type: string;

  @IsString()
  status: string;

  @IsEnum(SessionHealth)
  session_health: SessionHealth;

  @IsNumber()
  @IsOptional()
  balance?: number;

  @IsISO8601({ strict: true })
  created_at_utc: string;
}
