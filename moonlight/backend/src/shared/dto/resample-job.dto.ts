import { IsString, IsEnum, IsBoolean, IsOptional, Matches } from 'class-validator';
import { Timeframe } from '../enums/timeframe.enum';

export class ResampleJobDTO {
  @IsString()
  symbol: string;

  @IsEnum(Timeframe)
  from_tf: Timeframe;

  @IsEnum(Timeframe)
  to_tf: Timeframe;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD format' })
  date: string;

  @IsString()
  source: string;

  @IsBoolean()
  @IsOptional()
  overwrite_existing?: boolean;
}
