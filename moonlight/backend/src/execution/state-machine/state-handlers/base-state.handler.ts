import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { ExecutionContext, StateTransitionResult } from '../execution-fsm';

export abstract class BaseStateHandler {
  abstract supports(state: ExecutionState): boolean;
  abstract handle(context: ExecutionContext): Promise<StateTransitionResult>;
}
