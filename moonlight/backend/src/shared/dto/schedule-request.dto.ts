import { IsString, ValidateNested, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { CanonicalSignalDTO } from './canonical-signal.dto';

export class BrokerProductConfig {
  @IsString()
  broker_id: string;

  @IsString()
  product: string;

  available_expiry_slots_minutes: number[];
}

export class ScheduleRequestDTO {
  @ValidateNested()
  @Type(() => CanonicalSignalDTO)
  signal: CanonicalSignalDTO;

  @ValidateNested()
  @Type(() => BrokerProductConfig)
  broker_config: BrokerProductConfig;

  @IsISO8601({ strict: true })
  now_utc: string;
}
