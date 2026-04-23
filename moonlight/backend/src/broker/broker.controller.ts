import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { SessionHealthService } from './session/session-health.service';
import { BrokerAdapterRegistry } from './adapters/broker-adapter.registry';
import { BrokerCredentialsService } from './adapters/broker-credentials.service';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../shared/dto/broker-order.dto';

@Controller('broker')
export class BrokerController {
  constructor(
    private readonly idempotentOrderService: IdempotentOrderService,
    private readonly sessionHealthService: SessionHealthService,
    private readonly registry: BrokerAdapterRegistry,
    private readonly creds: BrokerCredentialsService,
  ) {}

  @Post('order/test')
  async testOrder(
    @Body() request: BrokerOrderRequestDTO,
  ): Promise<BrokerOrderAckDTO> {
    return this.idempotentOrderService.sendOrderIdempotent(request);
  }

  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      broker: 'FakeBroker',
      cache_size: this.idempotentOrderService.getCacheSize(),
    };
  }

  /**
   * GET /broker/adapters/health
   * Returns the live health snapshot of ALL registered broker adapters
   * (FAKE, IQ_OPTION, OLYMP_TRADE, BINOMO, EXPERT_OPTION).
   * Used by the desktop BrokerHealthPanel for real-time visibility.
   */
  @Get('adapters/health')
  getAdaptersHealth() {
    return {
      adapters: this.registry.getHealthSnapshot(),
      credentials: this.creds.summary(),
      mock_mode: this.creds.isMockMode(),
      generated_at_utc: new Date().toISOString(),
    };
  }

  @Get('accounts/:accountId/health')
  async getAccountHealth(@Param('accountId') accountId: string) {
    const health = await this.sessionHealthService.checkHealth(accountId);

    return {
      account_id: accountId,
      health,
      last_checked_at_utc: new Date().toISOString(),
    };
  }
}
