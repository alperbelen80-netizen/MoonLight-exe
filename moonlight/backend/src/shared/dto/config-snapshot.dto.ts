import { IsString, IsEnum, IsISO8601 } from 'class-validator';

export enum ConfigSnapshotScope {
  BACKTEST_RUN = 'BACKTEST_RUN',
  LIVE_PROFILE = 'LIVE_PROFILE',
  OWNER_ACTION = 'OWNER_ACTION',
}

export class ConfigSnapshotDTO {
  @IsString()
  id: string;

  @IsEnum(ConfigSnapshotScope)
  scope: ConfigSnapshotScope;

  @IsString()
  ref_id: string;

  @IsString()
  label: string;

  @IsString()
  payload_json: string;

  @IsISO8601({ strict: true })
  created_at_utc: string;

  @IsString()
  created_by: string;
}
