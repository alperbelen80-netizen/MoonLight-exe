import { IsString, IsArray, IsISO8601, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MismatchDTO {
  @IsString()
  id: string;

  @IsString()
  symbol: string;

  expected?: any;

  actual?: any;

  @IsString()
  reason: string;
}

export class ReconciliationResultDTO {
  @IsString()
  run_id: string;

  @IsString()
  account_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MismatchDTO)
  mismatched_positions: MismatchDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MismatchDTO)
  missing_internal: MismatchDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MismatchDTO)
  missing_broker: MismatchDTO[];

  @IsISO8601({ strict: true })
  checked_at_utc: string;
}
