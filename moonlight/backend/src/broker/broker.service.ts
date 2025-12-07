import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../shared/dto/broker-order.dto';
import { BrokerAdapterInterface, BROKER_ADAPTER } from './adapters/broker-adapter.interface';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { SessionManagerService } from './session/session-manager.service';
import { BrokerLatencyTracker } from './metrics/broker-latency-tracker.service';
import { SessionHealth } from '../shared/enums/session-health.enum';

@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);

  constructor(
    @Inject(BROKER_ADAPTER)
    private readonly brokerAdapter: BrokerAdapterInterface,
    private readonly idempotentOrderService: IdempotentOrderService,
    private readonly sessionManager: SessionManagerService,
    private readonly latencyTracker: BrokerLatencyTracker,
  ) {}

  async sendOrderWithIdempotency(
    request: BrokerOrderRequestDTO,
  ): Promise<BrokerOrderAckDTO> {
    const health = this.sessionManager.getSessionHealth(request.account_id);

    if (health === SessionHealth.COOLDOWN || health === SessionHealth.DOWN) {
      throw new Error(
        `Session for ${request.account_id} is ${health}, cannot send order`,
      );
    }

    const startTime = Date.now();
    let success = false;

    try {
      const result = await this.idempotentOrderService.sendOrderIdempotent(request);
      success = result.status === 'ACK';

      const latency = Date.now() - startTime;
      this.latencyTracker.recordLatency('FAKE_BROKER', latency, success);

      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.latencyTracker.recordLatency('FAKE_BROKER', latency, false);
      throw error;
    }
  }

  getBrokerAdapterForAccount(accountId: string): BrokerAdapterInterface {
    return this.brokerAdapter;
  }
}
