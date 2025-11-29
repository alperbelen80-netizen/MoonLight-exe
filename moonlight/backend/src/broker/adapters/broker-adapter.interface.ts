import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';

export interface BrokerAdapterInterface {
  sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO>;
  getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]>;
  getBalance(accountId: string): Promise<number>;
  connectSession(accountId: string): Promise<void>;
  disconnectSession(accountId: string): Promise<void>;
}

export const BROKER_ADAPTER = 'BROKER_ADAPTER';
