import { Injectable } from '@nestjs/common';
import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { BaseStateHandler } from './base-state.handler';
import { ExecutionContext, StateTransitionResult } from '../execution-fsm';

@Injectable()
export class OrderSentStateHandler extends BaseStateHandler {
  supports(state: ExecutionState): boolean {
    return state === ExecutionState.ORDER_SENT;
  }

  async handle(context: ExecutionContext): Promise<StateTransitionResult> {
    const brokerResponse = context.metadata?.broker_response;

    if (!brokerResponse) {
      return {
        next_state: ExecutionState.TIMEOUT,
        error_code: 'BROKER_NO_RESPONSE',
        error_reason: 'No response from broker within timeout',
      };
    }

    if (brokerResponse.status === 'REJECT') {
      return {
        next_state: ExecutionState.ORDER_REJECTED,
        error_code: brokerResponse.reject_code || 'BROKER_REJECT',
        error_reason: brokerResponse.reject_message,
      };
    }

    return {
      next_state: ExecutionState.ORDER_ACKED,
      metadata: {
        handler: 'OrderSentStateHandler',
        broker_order_id: brokerResponse.broker_order_id,
        latency_ms: brokerResponse.latency_ms,
      },
    };
  }
}
