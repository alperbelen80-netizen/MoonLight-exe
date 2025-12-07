import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExpertOptionHighFreqAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(ExpertOptionHighFreqAdapter.name);

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    this.logger.warn('Expert Option High-Freq: Placeholder implementation');

    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: `EXPERT_PLACEHOLDER_${uuidv4()}`,
      status: BrokerOrderStatus.REJECT,
      response_ts_utc: new Date().toISOString(),
      latency_ms: 0,
      reject_code: 'NOT_IMPLEMENTED',
      reject_message: 'Expert Option requires tick stream implementation',
    };
  }

  async getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]> {
    return [];
  }

  async getBalance(accountId: string): Promise<number> {
    return 0;
  }

  async connectSession(accountId: string): Promise<void> {
    this.logger.log('Expert Option session (placeholder)');
  }

  async disconnectSession(accountId: string): Promise<void> {
    this.logger.log('Expert Option disconnect (placeholder)');
  }
}
