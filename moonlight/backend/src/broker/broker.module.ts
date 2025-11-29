import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { FakeBrokerAdapter } from './adapters/fake-broker.adapter';
import { BROKER_ADAPTER } from './adapters/broker-adapter.interface';
import { BrokerController } from './broker.controller';
import { BrokerService } from './broker.service';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealthService } from './session/session-health.service';

@Module({
  controllers: [BrokerController],
  providers: [
    BrokerService,
    IdempotentOrderService,
    FakeBrokerAdapter,
    SessionManagerService,
    SessionHealthService,
    {
      provide: BROKER_ADAPTER,
      useClass: FakeBrokerAdapter,
    },
  ],
  exports: [BrokerService, IdempotentOrderService, SessionManagerService, SessionHealthService, BROKER_ADAPTER],
})
export class BrokerModule {}
