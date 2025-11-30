import { IsNumber, IsString, IsArray, IsISO8601 } from 'class-validator';

export class PackStatsDTO {
  @IsNumber()
  total_trades: number;

  @IsNumber()
  selected_by_pack_count: number;

  @IsNumber()
  rejected_by_gating_count: number;

  @IsNumber()
  avg_selected_ev: number | null;

  @IsNumber()
  avg_rejected_ev: number | null;

  @IsISO8601({ strict: true })
  last_updated_utc: string;
}

export class ExecutionHealthDTO {
  @IsNumber()
  last_hour_trades: number;

  @IsNumber()
  last_day_trades: number;

  @IsNumber()
  win_rate_last_hour: number | null;

  @IsNumber()
  win_rate_last_day: number | null;

  @IsNumber()
  blocked_by_risk_count_last_day: number;

  @IsNumber()
  blocked_by_ev_count_last_day: number;

  @IsNumber()
  blocked_by_hw_profile_last_day: number;

  @IsISO8601({ strict: true })
  last_updated_utc: string;
}
