import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from '../../../execution/execution.service';
import { ExecutionFSM } from '../../../execution/state-machine/execution-fsm';
import { ARTEngineService } from '../../../risk/art-engine/art-engine.service';
import { RiskProfileService } from '../../../risk/risk-profile.service';
import { RiskGuardrailService } from '../../../risk/risk-guardrail.service';
import { TripleCheckService } from '../../../risk/triple-check/triple-check.service';
import { M3DefensiveService } from '../../../risk/m3-defensive.service';
import { ApprovalQueueService } from '../../../risk/approval-queue.service';
import { CircuitBreakerService } from '../../../risk/fail-safe/circuit-breaker.service';
import { BrokerService } from '../../../broker/broker.service';
import { ExecutionState } from '../../../shared/enums/execution-state.enum';
import { ExecutionRequestDTO } from '../../../shared/dto/execution-request.dto';
import { CanonicalSignalDTO, SignalDirection, Environment, UncertaintyLevel } from '../../../shared/dto/canonical-signal.dto';
import { ARTDecision } from '../../../shared/dto/atomic-risk-token.dto';
import { BrokerOrderStatus } from '../../../shared/dto/broker-order.dto';

const mockFsm = {
  transition: jest.fn().mockResolvedValue({
    next_state: ExecutionState.ORDER_ACKED,
  }),
};

const mockArtEngine = {
  requestART: jest.fn().mockResolvedValue({
    art_id: 'ART_TEST',
    decision: ARTDecision.ACCEPT,
    approved_stake: 25,
  }),
};

const mockRiskProfile = {
  getById: jest.fn(),
  getDefaultProfile: jest.fn(),
};

const mockRiskGuardrail = {
  evaluateForBacktest: jest.fn().mockReturnValue({
    allowed: true,
    violations: [],
    effective_stake_amount: 25,
  }),
};

const mockTripleCheck = {
  evaluate: jest.fn().mockReturnValue({
    u1_score: 0.1,
    u2_score: 0.1,
    u3_score: 0.1,
    uncertainty_score: 0.1,
    level: 'LOW',
  }),
};

const mockM3Defensive = {
  decide: jest.fn().mockReturnValue({
    mode: 'AUTO',
    uncertainty_score: 0.1,
    uncertainty_level: 'LOW',
    final_action: 'EXECUTE',
  }),
};

const mockApprovalQueue = {
  enqueue: jest.fn(),
};

const mockCircuitBreaker = {
  isBlocked: jest.fn().mockReturnValue(false),
};

const mockBrokerService = {
  sendOrderWithIdempotency: jest.fn().mockResolvedValue({
    broker_request_id: 'REQ_001',
    broker_order_id: 'ORDER_001',
    status: BrokerOrderStatus.ACK,
    response_ts_utc: new Date().toISOString(),
    latency_ms: 50,
  }),
};

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: ExecutionFSM, useValue: mockFsm },
        { provide: ARTEngineService, useValue: mockArtEngine },
        { provide: RiskProfileService, useValue: mockRiskProfile },
        { provide: RiskGuardrailService, useValue: mockRiskGuardrail },
        { provide: TripleCheckService, useValue: mockTripleCheck },
        { provide: M3DefensiveService, useValue: mockM3Defensive },
        { provide: ApprovalQueueService, useValue: mockApprovalQueue },
        { provide: CircuitBreakerService, useValue: mockCircuitBreaker },
        { provide: BrokerService, useValue: mockBrokerService },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
    jest.clearAllMocks();
  });

  const createMockSignal = (): CanonicalSignalDTO => ({
    signal_id: 'SIG_001',
    idempotency_key: 'hash_001',
    source: 'test',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: '2025-01-18T10:00:00.000Z',
    direction: SignalDirection.CALL,
    ev: 0.05,
    confidence_score: 0.7,
    valid_until: '2025-01-18T10:01:00.000Z',
    latency_budget_ms: 200,
    schema_version: 1,
    environment: Environment.LIVE,
  });

  it('should execute signal successfully with AUTO mode and LOW uncertainty', async () => {
    const request: ExecutionRequestDTO = {
      signal: createMockSignal(),
      environment: Environment.LIVE,
      account_id: 'ACC_001',
    };

    const result = await service.startExecution(request);

    expect(result.trade_uid).toBeDefined();
    expect(result.current_state).toBe(ExecutionState.ORDER_ACKED);
    expect(mockBrokerService.sendOrderWithIdempotency).toHaveBeenCalled();
  });

  it('should block signal when circuit breaker active', async () => {
    mockCircuitBreaker.isBlocked.mockReturnValue(true);

    const request: ExecutionRequestDTO = {
      signal: createMockSignal(),
      environment: Environment.LIVE,
      account_id: 'ACC_001',
    };

    const result = await service.startExecution(request);

    expect(result.current_state).toBe(ExecutionState.CANCELLED);
    expect(mockBrokerService.sendOrderWithIdempotency).not.toHaveBeenCalled();
  });
});
