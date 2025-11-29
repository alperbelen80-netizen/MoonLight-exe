import { Module, OnModuleInit } from '@nestjs/common';
import { ExecutionFSM } from './state-machine/execution-fsm';
import { ReceivedStateHandler } from './state-machine/state-handlers/received-state.handler';
import { RiskCheckedStateHandler } from './state-machine/state-handlers/risk-checked-state.handler';
import { OrderSentStateHandler } from './state-machine/state-handlers/order-sent-state.handler';
import { ExecutionState } from '../shared/enums/execution-state.enum';

@Module({
  providers: [
    ExecutionFSM,
    ReceivedStateHandler,
    RiskCheckedStateHandler,
    OrderSentStateHandler,
  ],
  exports: [ExecutionFSM],
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
