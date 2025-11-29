import { IsString, IsEnum, IsNumber, IsISO8601, IsArray, IsOptional } from 'class-validator';

export enum ScheduleStatus {
  SCHEDULED = 'SCHEDULED',
  TOO_LATE = 'TOO_LATE',
  UNSUPPORTED_TF = 'UNSUPPORTED_TF',
  INVALID_SLOT = 'INVALID_SLOT',
}

export class ScheduleResultDTO {
  @IsEnum(ScheduleStatus)
  status: ScheduleStatus;

  @IsISO8601({ strict: true })
  @IsOptional()
  scheduled_execution_time_utc?: string;

  @IsNumber()
  @IsOptional()
  slot_minutes?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reason_codes?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}
