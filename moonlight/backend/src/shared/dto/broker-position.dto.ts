import { IsString, IsEnum, IsNumber, IsISO8601 } from 'class-validator';
import { SignalDirection } from './canonical-signal.dto';

export enum BrokerPositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export class BrokerPositionDTO {
  @IsString()
  position_id: string;

  @IsString()
  symbol: string;

  @IsEnum(SignalDirection)
  direction: SignalDirection;

  @IsNumber()
  stake_amount: number;

  @IsNumber()
  entry_price: number;

  @IsISO8601({ strict: true })
  open_ts_utc: string;

  @IsISO8601({ strict: true })
  expiry_ts_utc: string;

  @IsEnum(BrokerPositionStatus)
  status: BrokerPositionStatus;
}
