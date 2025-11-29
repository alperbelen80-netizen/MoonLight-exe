import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionFSM, ExecutionContext } from '../../../execution/state-machine/execution-fsm';
import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { ReceivedStateHandler } from '../../../execution/state-machine/state-handlers/received-state.handler';
import { RiskCheckedStateHandler } from '../../../execution/state-machine/state-handlers/risk-checked-state.handler';
import { OrderSentStateHandler } from '../../../execution/state-machine/state-handlers/order-sent-state.handler';

describe('ExecutionFSM', () => {
  let fsm: ExecutionFSM;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionFSM,
        ReceivedStateHandler,
        RiskCheckedStateHandler,
        OrderSentStateHandler,
      ],
    }).compile();

    fsm = module.get<ExecutionFSM>(ExecutionFSM);
    const receivedHandler = module.get<ReceivedStateHandler>(ReceivedStateHandler);
    const riskCheckedHandler = module.get<RiskCheckedStateHandler>(RiskCheckedStateHandler);
    const orderSentHandler = module.get<OrderSentStateHandler>(OrderSentStateHandler);

    fsm.registerHandler(ExecutionState.SIGNAL_CREATED, receivedHandler);
    fsm.registerHandler(ExecutionState.RISK_CHECKED, riskCheckedHandler);
    fsm.registerHandler(ExecutionState.ORDER_SENT, orderSentHandler);
  });

  it('should transition from SIGNAL_CREATED to SIGNAL_VALIDATED', async () => {
    const context: ExecutionContext = {
      trade_uid: 'TRD_001',
      signal_id: 'SIG_001',
      current_state: ExecutionState.SIGNAL_CREATED,
      metadata: {},
    };

    const result = await fsm.transition(context);
    expect(result.next_state).toBe(ExecutionState.SIGNAL_VALIDATED);
    expect(result.error_code).toBeUndefined();
  });

  it('should transition from RISK_CHECKED to CONFLICT_RESOLVED (ART approved)', async () => {
    const context: ExecutionContext = {
      trade_uid: 'TRD_002',
      signal_id: 'SIG_002',
      current_state: ExecutionState.RISK_CHECKED,
      metadata: {
        art_decision: 'ACCEPT',
        art_id: 'ART_001',
      },
    };

    const result = await fsm.transition(context);
    expect(result.next_state).toBe(ExecutionState.CONFLICT_RESOLVED);
    expect(result.metadata?.art_id).toBe('ART_001');
  });

  it('should transition from RISK_CHECKED to CANCELLED (ART blocked)', async () => {
    const context: ExecutionContext = {
      trade_uid: 'TRD_003',
      signal_id: 'SIG_003',
      current_state: ExecutionState.RISK_CHECKED,
      metadata: {
        art_decision: 'REJECT',
      },
    };

    const result = await fsm.transition(context);
    expect(result.next_state).toBe(ExecutionState.CANCELLED);
    expect(result.error_code).toBe('ART_BLOCKED');
  });

  it('should return FAILED_HARD for unsupported state', async () => {
    const context: ExecutionContext = {
      trade_uid: 'TRD_004',
      signal_id: 'SIG_004',
      current_state: ExecutionState.POSITION_OPENED,
      metadata: {},
    };

    const result = await fsm.transition(context);
    expect(result.next_state).toBe(ExecutionState.FAILED_HARD);
    expect(result.error_code).toBe('NO_HANDLER');
  });

  it('should not transition from terminal state POST_ANALYSIS_DONE', async () => {
    const context: ExecutionContext = {
      trade_uid: 'TRD_005',
      signal_id: 'SIG_005',
      current_state: ExecutionState.POST_ANALYSIS_DONE,
      metadata: {},
    };

    const result = await fsm.transition(context);
    expect(result.next_state).toBe(ExecutionState.POST_ANALYSIS_DONE);
    expect(result.error_code).toBe('TERMINAL_STATE');
  });

  it('should validate allowed transitions (canTransition)', () => {
    expect(fsm.canTransition(ExecutionState.SIGNAL_CREATED, ExecutionState.SIGNAL_VALIDATED)).toBe(true);
    expect(fsm.canTransition(ExecutionState.SIGNAL_CREATED, ExecutionState.ORDER_SENT)).toBe(false);
    expect(fsm.canTransition(ExecutionState.RISK_CHECKED, ExecutionState.CONFLICT_RESOLVED)).toBe(true);
    expect(fsm.canTransition(ExecutionState.POST_ANALYSIS_DONE, ExecutionState.SIGNAL_CREATED)).toBe(false);
  });
});
