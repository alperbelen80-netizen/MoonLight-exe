import { Injectable } from '@nestjs/common';
import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { BaseStateHandler } from './base-state.handler';
import { ExecutionContext, StateTransitionResult } from '../execution-fsm';

@Injectable()
export class RiskCheckedStateHandler extends BaseStateHandler {
  supports(state: ExecutionState): boolean {
    return state === ExecutionState.RISK_CHECKED;
  }

  async handle(context: ExecutionContext): Promise<StateTransitionResult> {
    const artApproved = context.metadata?.art_decision === 'ACCEPT';

    if (!artApproved) {
      return {
        next_state: ExecutionState.CANCELLED,
        error_code: 'ART_BLOCKED',
        error_reason: 'Risk check failed, ART not issued',
      };
    }

    return {
      next_state: ExecutionState.CONFLICT_RESOLVED,
      metadata: {
        handler: 'RiskCheckedStateHandler',
        art_id: context.metadata?.art_id,
      },
    };
  }
}
