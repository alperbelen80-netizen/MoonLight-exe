import { Injectable } from '@nestjs/common';
import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { BaseStateHandler } from './base-state.handler';
import { ExecutionContext, StateTransitionResult } from '../execution-fsm';

@Injectable()
export class ReceivedStateHandler extends BaseStateHandler {
  supports(state: ExecutionState): boolean {
    return state === ExecutionState.SIGNAL_CREATED;
  }

  async handle(context: ExecutionContext): Promise<StateTransitionResult> {
    return {
      next_state: ExecutionState.SIGNAL_VALIDATED,
      metadata: {
        handler: 'ReceivedStateHandler',
        processed_at: new Date().toISOString(),
      },
    };
  }
}
