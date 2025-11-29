import { Injectable, Logger, Inject } from '@nestjs/common';
import { BROKER_ADAPTER, BrokerAdapterInterface } from './adapters/broker-adapter.interface';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../shared/dto/broker-order.dto';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealth } from '../shared/enums/session-health.enum';

@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);

  constructor(
    @Inject(BROKER_ADAPTER)
    private readonly brokerAdapter: BrokerAdapterInterface,
    private readonly idempotentOrderService: IdempotentOrderService,
    private readonly sessionManager: SessionManagerService,
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

    return this.idempotentOrderService.sendOrderIdempotent(request);
  }

  getBrokerAdapterForAccount(accountId: string): BrokerAdapterInterface {
    return this.brokerAdapter;
  }
}
