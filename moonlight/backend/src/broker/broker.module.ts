import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { FakeBrokerAdapter } from './adapters/fake-broker.adapter';
import { BROKER_ADAPTER } from './adapters/broker-adapter.interface';
import { BrokerController } from './broker.controller';
import { BrokerService } from './broker.service';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealthService } from './session/session-health.service';
import { AccountEnforcementService } from './account-enforcement.service';
import { BrokerLatencyTracker } from './metrics/broker-latency-tracker.service';
import { BrokerScoringService } from './metrics/broker-scoring.service';
import { MultiBrokerRouter } from './multi-broker-router.service';
import { PayoutMatrixService } from './payout/payout-matrix.service';
import { OwnerAccount } from '../database/entities/owner-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OwnerAccount])],
  controllers: [BrokerController],
  providers: [
    BrokerService,
    IdempotentOrderService,
    FakeBrokerAdapter,
    SessionManagerService,
    SessionHealthService,
    AccountEnforcementService,
    BrokerLatencyTracker,
    BrokerScoringService,
    MultiBrokerRouter,
    PayoutMatrixService,
    {
      provide: BROKER_ADAPTER,
      useClass: FakeBrokerAdapter,
    },
  ],
  exports: [
    BrokerService,
    IdempotentOrderService,
    SessionManagerService,
    SessionHealthService,
    AccountEnforcementService,
    BrokerLatencyTracker,
    BrokerScoringService,
    MultiBrokerRouter,
    PayoutMatrixService,
    BROKER_ADAPTER,
  ],
})
export class BrokerModule {}
