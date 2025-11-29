import { IsString, IsEnum, IsISO8601, IsOptional, IsObject } from 'class-validator';
import { ExecutionState } from '../enums/execution-state.enum';

export class ExecutionStateDTO {
  @IsString()
  trade_uid: string;

  @IsString()
  signal_id: string;

  @IsEnum(ExecutionState)
  current_state: ExecutionState;

  @IsEnum(ExecutionState)
  @IsOptional()
  previous_state?: ExecutionState;

  @IsISO8601({ strict: true })
  state_entered_at: string;

  @IsString()
  @IsOptional()
  error_code?: string;

  @IsString()
  @IsOptional()
  error_reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
