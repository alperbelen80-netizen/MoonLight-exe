import { Controller, Post, Body, Get } from '@nestjs/common';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../shared/dto/broker-order.dto';

@Controller('broker')
export class BrokerController {
  constructor(
    private readonly idempotentOrderService: IdempotentOrderService,
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
}
