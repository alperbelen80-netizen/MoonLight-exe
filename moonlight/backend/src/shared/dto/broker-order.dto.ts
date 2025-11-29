import { IsString, IsEnum, IsNumber, IsISO8601, Min, IsOptional } from 'class-validator';
import { SignalDirection } from './canonical-signal.dto';

export enum BrokerOrderStatus {
  ACK = 'ACK',
  REJECT = 'REJECT',
  TIMEOUT = 'TIMEOUT',
}

export class BrokerOrderRequestDTO {
  @IsString()
  broker_request_id: string;

  @IsString()
  order_key: string;

  @IsString()
  symbol: string;

  @IsEnum(SignalDirection)
  direction: SignalDirection;

  @IsNumber()
  @Min(0)
  stake_amount: number;

  @IsNumber()
  @Min(1)
  expiry_minutes: number;

  @IsString()
  art_id: string;

  @IsString()
  account_id: string;

  @IsISO8601({ strict: true })
  request_ts_utc: string;
}

export class BrokerOrderAckDTO {
  @IsString()
  broker_request_id: string;

  @IsString()
  broker_order_id: string;

  @IsEnum(BrokerOrderStatus)
  status: BrokerOrderStatus;

  @IsISO8601({ strict: true })
  response_ts_utc: string;

  @IsNumber()
  @Min(0)
  latency_ms: number;

  @IsString()
  @IsOptional()
  reject_code?: string;

  @IsString()
  @IsOptional()
  reject_message?: string;

  @IsNumber()
  @IsOptional()
  open_price?: number;

  @IsISO8601({ strict: true })
  @IsOptional()
  open_ts_utc?: string;
}
