import { IsString, IsEnum, IsISO8601, IsNumber, Min } from 'class-validator';
import { Timeframe } from '../enums/timeframe.enum';

export class OhlcvBarDTO {
  @IsString()
  symbol: string;

  @IsEnum(Timeframe)
  tf: Timeframe;

  @IsISO8601({ strict: true })
  ts_utc: string;

  @IsNumber()
  @Min(0)
  open: number;

  @IsNumber()
  @Min(0)
  high: number;

  @IsNumber()
  @Min(0)
  low: number;

  @IsNumber()
  @Min(0)
  close: number;

  @IsNumber()
  @Min(0)
  volume: number;

  @IsString()
  source: string;
}
