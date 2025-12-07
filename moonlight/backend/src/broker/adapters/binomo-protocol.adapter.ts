import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BinomoProtocolAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(BinomoProtocolAdapter.name);

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    this.logger.warn('Binomo Protocol Bridge: Placeholder implementation');

    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: `BINOMO_PLACEHOLDER_${uuidv4()}`,
      status: BrokerOrderStatus.REJECT,
      response_ts_utc: new Date().toISOString(),
      latency_ms: 0,
      reject_code: 'NOT_IMPLEMENTED',
      reject_message: 'Binomo requires protocol bridge implementation',
    };
  }

  async getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]> {
    return [];
  }

  async getBalance(accountId: string): Promise<number> {
    return 0;
  }

  async connectSession(accountId: string): Promise<void> {
    this.logger.log('Binomo session (placeholder)');
  }

  async disconnectSession(accountId: string): Promise<void> {
    this.logger.log('Binomo disconnect (placeholder)');
  }
}
