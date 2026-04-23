import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotentOrderService } from './order/idempotent-order.service';
import { FakeBrokerAdapter } from './adapters/fake-broker.adapter';
import { IQOptionRealAdapter } from './adapters/iq-option-real.adapter';
import { OlympTradePGSAdapter } from './adapters/olymp-trade-pgs.adapter';
import { BinomoProtocolAdapter } from './adapters/binomo-protocol.adapter';
import { ExpertOptionHighFreqAdapter } from './adapters/expert-option-highfreq.adapter';
import { BrokerAdapterRegistry } from './adapters/broker-adapter.registry';
import { BrokerCredentialsService } from './adapters/broker-credentials.service';
import { BROKER_ADAPTER } from './adapters/broker-adapter.interface';
import { BrokerController } from './broker.controller';
import { SessionManagerController } from './adapters/session-manager.controller';
import { BrokerService } from './broker.service';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealthService } from './session/session-health.service';
import { AccountEnforcementService } from './account-enforcement.service';
import { BrokerLatencyTracker } from './metrics/broker-latency-tracker.service';
import { BrokerScoringService } from './metrics/broker-scoring.service';
import { MultiBrokerRouter } from './multi-broker-router.service';
import { PayoutMatrixService } from './payout/payout-matrix.service';
import { OwnerAccount } from '../database/entities/owner-account.entity';
import { BrokerHealthModule } from './health/broker-health.module';
import { BrokerHealthRegistryService } from './health/broker-health-registry.service';
import {
  BrokerSimRegistry,
  SimulatedBrokerAdapter,
  SIMULATED_BROKER_TOKENS,
} from './adapters/simulated/simulated-broker.adapter';
import { BrokerSimController } from './adapters/simulated/broker-sim.controller';

/**
 * V2.5-2 broker module wiring.
 *
 * The BrokerHealthModule is now imported so SimulatedBrokerAdapter factories
 * can push state transitions into the central registry. Five simulated
 * adapters (one per broker id) are provided via token factories and
 * registered with BrokerSimRegistry on construction.
 */
function makeSimFactory(
  brokerId: 'IQ_OPTION' | 'OLYMP_TRADE' | 'BINOMO' | 'EXPERT_OPTION' | 'FAKE',
) {
  return (
    registry: BrokerSimRegistry,
    health: BrokerHealthRegistryService,
  ) => {
    const adapter = new SimulatedBrokerAdapter(brokerId, health);
    registry.register(adapter);
    return adapter;
  };
}

@Module({
  imports: [TypeOrmModule.forFeature([OwnerAccount]), BrokerHealthModule],
  controllers: [BrokerController, SessionManagerController, BrokerSimController],
  providers: [
    BrokerService,
    IdempotentOrderService,
    FakeBrokerAdapter,
    IQOptionRealAdapter,
    OlympTradePGSAdapter,
    BinomoProtocolAdapter,
    ExpertOptionHighFreqAdapter,
    BrokerAdapterRegistry,
    BrokerCredentialsService,
    SessionManagerService,
    SessionHealthService,
    AccountEnforcementService,
    BrokerLatencyTracker,
    BrokerScoringService,
    MultiBrokerRouter,
    PayoutMatrixService,
    // V2.5-2: simulator stack.
    BrokerSimRegistry,
    {
      provide: SIMULATED_BROKER_TOKENS.IQ_OPTION,
      useFactory: makeSimFactory('IQ_OPTION'),
      inject: [BrokerSimRegistry, BrokerHealthRegistryService],
    },
    {
      provide: SIMULATED_BROKER_TOKENS.OLYMP_TRADE,
      useFactory: makeSimFactory('OLYMP_TRADE'),
      inject: [BrokerSimRegistry, BrokerHealthRegistryService],
    },
    {
      provide: SIMULATED_BROKER_TOKENS.BINOMO,
      useFactory: makeSimFactory('BINOMO'),
      inject: [BrokerSimRegistry, BrokerHealthRegistryService],
    },
    {
      provide: SIMULATED_BROKER_TOKENS.EXPERT_OPTION,
      useFactory: makeSimFactory('EXPERT_OPTION'),
      inject: [BrokerSimRegistry, BrokerHealthRegistryService],
    },
    {
      provide: SIMULATED_BROKER_TOKENS.FAKE,
      useFactory: makeSimFactory('FAKE'),
      inject: [BrokerSimRegistry, BrokerHealthRegistryService],
    },
    {
      provide: BROKER_ADAPTER,
      useClass: FakeBrokerAdapter,
    },
  ],
  exports: [
    BrokerService,
    IdempotentOrderService,
    FakeBrokerAdapter,
    IQOptionRealAdapter,
    OlympTradePGSAdapter,
    BinomoProtocolAdapter,
    ExpertOptionHighFreqAdapter,
    BrokerAdapterRegistry,
    BrokerCredentialsService,
    SessionManagerService,
    SessionHealthService,
    AccountEnforcementService,
    BrokerLatencyTracker,
    BrokerScoringService,
    MultiBrokerRouter,
    PayoutMatrixService,
    BrokerSimRegistry,
    BROKER_ADAPTER,
  ],
})
export class BrokerModule {}
