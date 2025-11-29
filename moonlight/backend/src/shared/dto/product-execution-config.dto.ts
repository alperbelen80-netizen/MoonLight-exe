import { IsString, IsBoolean, IsISO8601 } from 'class-validator';

export class ProductExecutionConfigDTO {
  @IsString()
  id: string;

  @IsString()
  symbol: string;

  @IsString()
  tf: string;

  @IsBoolean()
  data_enabled: boolean;

  @IsBoolean()
  signal_enabled: boolean;

  @IsBoolean()
  auto_trade_enabled: boolean;

  @IsISO8601({ strict: true })
  updated_at_utc: string;
}
