import { Injectable, Logger } from '@nestjs/common';
import { ExecutionState, TERMINAL_STATES } from '../../shared/enums/execution-state.enum';
import { BaseStateHandler } from './state-handlers/base-state.handler';

export interface ExecutionContext {
  trade_uid: string;
  signal_id: string;
  current_state: ExecutionState;
  metadata: Record<string, any>;
}

export interface StateTransitionResult {
  next_state: ExecutionState;
  error_code?: string;
  error_reason?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ExecutionFSM {
  private readonly logger = new Logger(ExecutionFSM.name);
  private handlers: Map<ExecutionState, BaseStateHandler> = new Map();

  registerHandler(state: ExecutionState, handler: BaseStateHandler): void {
    this.handlers.set(state, handler);
    this.logger.debug(`Registered handler for state: ${state}`);
  }

  async transition(
    context: ExecutionContext,
  ): Promise<StateTransitionResult> {
    const { current_state, trade_uid } = context;

    if (TERMINAL_STATES.includes(current_state)) {
      this.logger.warn(
        `Trade ${trade_uid} is in terminal state ${current_state}, no further transitions`,
      );
      return {
        next_state: current_state,
        error_code: 'TERMINAL_STATE',
        error_reason: `State ${current_state} is terminal`,
      };
    }

    const handler = this.handlers.get(current_state);
    if (!handler) {
      this.logger.error(
        `No handler registered for state: ${current_state}, trade_uid: ${trade_uid}`,
      );
      return {
        next_state: ExecutionState.FAILED_HARD,
        error_code: 'NO_HANDLER',
        error_reason: `No handler for state ${current_state}`,
      };
    }

    try {
      const result = await handler.handle(context);
      this.logger.log(
        `Trade ${trade_uid}: ${current_state} → ${result.next_state}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error in state ${current_state} for trade ${trade_uid}: ${error.message}`,
      );
      return {
        next_state: ExecutionState.FAILED_HARD,
        error_code: 'HANDLER_EXCEPTION',
        error_reason: error.message,
      };
    }
  }

  canTransition(from: ExecutionState, to: ExecutionState): boolean {
    const allowedTransitions: Record<ExecutionState, ExecutionState[]> = {
      [ExecutionState.SIGNAL_CREATED]: [
        ExecutionState.SIGNAL_VALIDATED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.SIGNAL_VALIDATED]: [
        ExecutionState.ROUTED,
        ExecutionState.RISK_CHECKED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.ROUTED]: [
        ExecutionState.RISK_CHECKED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.RISK_CHECKED]: [
        ExecutionState.CONFLICT_RESOLVED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.CONFLICT_RESOLVED]: [
        ExecutionState.SCHEDULED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.SCHEDULED]: [
        ExecutionState.DISPATCHED,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.DISPATCHED]: [
        ExecutionState.ORDER_SENT,
        ExecutionState.CANCELLED,
      ],
      [ExecutionState.ORDER_SENT]: [
        ExecutionState.ORDER_ACKED,
        ExecutionState.ORDER_REJECTED,
        ExecutionState.TIMEOUT,
      ],
      [ExecutionState.ORDER_ACKED]: [
        ExecutionState.POSITION_OPENED,
        ExecutionState.FAILED_HARD,
      ],
      [ExecutionState.ORDER_REJECTED]: [ExecutionState.POST_ANALYSIS_DONE],
      [ExecutionState.POSITION_OPENED]: [
        ExecutionState.POSITION_CLOSED,
        ExecutionState.FAILED_HARD,
      ],
      [ExecutionState.POSITION_CLOSED]: [ExecutionState.PNL_REALIZED],
      [ExecutionState.PNL_REALIZED]: [ExecutionState.POST_ANALYSIS_DONE],
      [ExecutionState.CANCELLED]: [ExecutionState.POST_ANALYSIS_DONE],
      [ExecutionState.TIMEOUT]: [ExecutionState.POST_ANALYSIS_DONE],
      [ExecutionState.FAILED_HARD]: [ExecutionState.POST_ANALYSIS_DONE],
      [ExecutionState.POST_ANALYSIS_DONE]: [],
    };

    const allowed = allowedTransitions[from] || [];
    return allowed.includes(to);
  }
}
