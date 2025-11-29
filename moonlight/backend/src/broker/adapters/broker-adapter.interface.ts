import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../../shared/dto/broker-order.dto';

export interface BrokerAdapterInterface {
  placeOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO>;
}

export const BROKER_ADAPTER = 'BROKER_ADAPTER';
