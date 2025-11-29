import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionFSM } from './state-machine/execution-fsm';
import { ReceivedStateHandler } from './state-machine/state-handlers/received-state.handler';
import { RiskCheckedStateHandler } from './state-machine/state-handlers/risk-checked-state.handler';
import { OrderSentStateHandler } from './state-machine/state-handlers/order-sent-state.handler';
import { ExecutionState } from '../shared/enums/execution-state.enum';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ConflictResolverService } from './conflict-resolver/conflict-resolver.service';
import { FixedTimeScheduler } from './scheduler/fixed-time-scheduler';
import { ReconciliationWorker } from './reconciliation/reconciliation.worker';
import { ReconciliationController } from './reconciliation/reconciliation.controller';
import { ReconciliationRun } from '../database/entities/reconciliation-run.entity';
import { RiskModule } from '../risk/risk.module';
import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReconciliationRun]),
    RiskModule,
    BrokerModule,
  ],
  controllers: [ExecutionController, ReconciliationController],
  providers: [
    ExecutionFSM,
    ReceivedStateHandler,
    RiskCheckedStateHandler,
    OrderSentStateHandler,
    ExecutionService,
    ConflictResolverService,
    FixedTimeScheduler,
    ReconciliationWorker,
  ],
  exports: [ExecutionFSM, ExecutionService],
})
export class ExecutionModule implements OnModuleInit {
  constructor(
    private readonly fsm: ExecutionFSM,
    private readonly receivedHandler: ReceivedStateHandler,
    private readonly riskCheckedHandler: RiskCheckedStateHandler,
    private readonly orderSentHandler: OrderSentStateHandler,
  ) {}

  onModuleInit(): void {
    this.fsm.registerHandler(ExecutionState.SIGNAL_CREATED, this.receivedHandler);
    this.fsm.registerHandler(ExecutionState.RISK_CHECKED, this.riskCheckedHandler);
    this.fsm.registerHandler(ExecutionState.ORDER_SENT, this.orderSentHandler);
  }
}
