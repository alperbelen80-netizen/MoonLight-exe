import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FakeBrokerAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(FakeBrokerAdapter.name);
  private shouldFail = false;
  private failCount = 0;

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
    this.failCount = 0;
  }

  setFailOnce(): void {
    this.failCount = 1;
  }

  async placeOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    this.logger.log(
      `[FakeBroker] Received order: ${request.symbol} ${request.direction} $${request.stake_amount}`,
    );

    if (this.shouldFail || this.failCount > 0) {
      if (this.failCount > 0) {
        this.failCount--;
      }
      throw new Error('FakeBroker simulated failure');
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    const ack: BrokerOrderAckDTO = {
      broker_request_id: request.broker_request_id,
      broker_order_id: `FAKE_ORDER_${uuidv4()}`,
      status: BrokerOrderStatus.ACK,
      response_ts_utc: new Date().toISOString(),
      latency_ms: 50,
      open_price: 2035.5,
      open_ts_utc: new Date().toISOString(),
    };

    return ack;
  }
}
