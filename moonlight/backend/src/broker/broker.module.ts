import { Module } from '@nestjs/common';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { FakeBrokerAdapter } from './adapters/fake-broker.adapter';
import { BROKER_ADAPTER } from './adapters/broker-adapter.interface';
import { BrokerController } from './broker.controller';

@Module({
  controllers: [BrokerController],
  providers: [
    IdempotentOrderService,
    FakeBrokerAdapter,
    {
      provide: BROKER_ADAPTER,
      useClass: FakeBrokerAdapter,
    },
  ],
  exports: [IdempotentOrderService, BROKER_ADAPTER],
})
export class BrokerModule {}
