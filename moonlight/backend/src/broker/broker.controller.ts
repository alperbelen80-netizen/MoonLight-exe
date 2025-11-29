import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { SessionHealthService } from './session/session-health.service';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../shared/dto/broker-order.dto';
import { SessionHealth } from '../shared/enums/session-health.enum';

@Controller('broker')
export class BrokerController {
  constructor(
    private readonly idempotentOrderService: IdempotentOrderService,
    private readonly sessionHealthService: SessionHealthService,
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
