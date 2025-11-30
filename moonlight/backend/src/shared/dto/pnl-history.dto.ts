import { IsString, IsArray, IsNumber, IsEnum } from 'class-validator';

export class DailyPnlPoint {
  @IsString()
  date: string;

  @IsString()
  environment: string;

  @IsNumber()
  trades: number;

  @IsNumber()
  wins: number;

  @IsNumber()
  losses: number;

  @IsNumber()
  blocked_by_risk: number;

  @IsNumber()
  blocked_by_ev: number;

  @IsNumber()
  blocked_by_hw_profile: number;

  @IsNumber()
  net_pnl: number;
}

export class PnlHistoryDTO {
  @IsArray()
  points: DailyPnlPoint[];

  @IsString()
  range: string;

  @IsString()
  generated_at_utc: string;
}
