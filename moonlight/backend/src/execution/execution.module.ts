import { Module } from '@nestjs/common';
import { ExecutionFSM } from './state-machine/execution-fsm';
import { ReceivedStateHandler } from './state-machine/state-handlers/received-state.handler';
import { RiskCheckedStateHandler } from './state-machine/state-handlers/risk-checked-state.handler';
import { OrderSentStateHandler } from './state-machine/state-handlers/order-sent-state.handler';

@Module({
  providers: [
    ExecutionFSM,
    ReceivedStateHandler,
    RiskCheckedStateHandler,
    OrderSentStateHandler,
  ],
  exports: [ExecutionFSM],
})
export class ExecutionModule {
  constructor(
    private readonly fsm: ExecutionFSM,
    private readonly receivedHandler: ReceivedStateHandler,
    private readonly riskCheckedHandler: RiskCheckedStateHandler,
    private readonly orderSentHandler: OrderSentStateHandler,
  ) {
    this.fsm.registerHandler(
      receivedHandler.supports.name as any,
      receivedHandler,
    );
    this.fsm.registerHandler(
      riskCheckedHandler.supports.name as any,
      riskCheckedHandler,
    );
    this.fsm.registerHandler(
      orderSentHandler.supports.name as any,
      orderSentHandler,
    );
  }
}
