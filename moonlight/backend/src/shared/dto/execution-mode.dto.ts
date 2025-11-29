import { IsEnum, IsISO8601 } from 'class-validator';
import { ExecutionMode } from '../enums/execution-mode.enum';

export class ExecutionModeDTO {
  @IsEnum(ExecutionMode)
  mode: ExecutionMode;

  @IsISO8601({ strict: true })
  updated_at_utc: string;
}
