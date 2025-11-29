import { Test, TestingModule } from '@nestjs/testing';
import { ConflictResolverService } from '../../../execution/conflict-resolver/conflict-resolver.service';
import {
  ConflictCheckRequest,
  ConflictDecision,
  OpenTradeDTO,
} from '../../../shared/dto/conflict-check.dto';
import {
  CanonicalSignalDTO,
  SignalDirection,
  Environment,
  UncertaintyLevel,
} from '../../../shared/dto/canonical-signal.dto';
import { DEFAULT_RISK_LIMITS } from '../../../risk/models/risk-limits.model';

describe('ConflictResolverService', () => {
  let service: ConflictResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConflictResolverService],
    }).compile();

    service = module.get<ConflictResolverService>(ConflictResolverService);
  });

  const mockSignal: CanonicalSignalDTO = {
    signal_id: 'SIG_CONFLICT_001',
    idempotency_key: 'hash_conflict_001',
    source: 'test_strategy',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: '2025-01-18T10:00:00.000Z',
    direction: SignalDirection.CALL,
    ev: 0.042,
    confidence_score: 0.72,
    valid_until: '2025-01-18T10:01:00.000Z',
    latency_budget_ms: 200,
    uncertainty_level: UncertaintyLevel.LOW,
    requested_stake: 25.0,
    schema_version: 1,
    environment: Environment.LIVE,
  };

  it('should ALLOW when no conflicts exist', async () => {
    const request: ConflictCheckRequest = {
      new_signal: mockSignal,
      open_trades: [],
      scheduled_trades: [],
    };

    const result = await service.checkConflict(request, DEFAULT_RISK_LIMITS);
    expect(result.decision).toBe(ConflictDecision.ALLOW);
    expect(result.reason_codes).toHaveLength(0);
  });

  it('should BLOCK when same symbol+direction+tf trade exists', async () => {
    const existingTrade: OpenTradeDTO = {
      trade_uid: 'TRD_EXISTING_001',
      symbol: 'XAUUSD',
      tf: '1m',
      direction: 'CALL',
      expiry_slot_minutes: 5,
      cluster: 'METAL',
    };

    const request: ConflictCheckRequest = {
      new_signal: mockSignal,
      open_trades: [existingTrade],
      scheduled_trades: [],
    };

    const result = await service.checkConflict(request, DEFAULT_RISK_LIMITS);
    expect(result.decision).toBe(ConflictDecision.BLOCK);
    expect(result.reason_codes).toContain('SAME_SYMBOL_DIRECTION_EXISTS');
  });

  it('should ALLOW when different direction (CALL vs PUT)', async () => {
    const existingTrade: OpenTradeDTO = {
      trade_uid: 'TRD_EXISTING_002',
      symbol: 'XAUUSD',
      tf: '1m',
      direction: 'PUT',
      expiry_slot_minutes: 5,
      cluster: 'METAL',
    };

    const request: ConflictCheckRequest = {
      new_signal: mockSignal,
      open_trades: [existingTrade],
      scheduled_trades: [],
    };

    const result = await service.checkConflict(request, DEFAULT_RISK_LIMITS);
    expect(result.decision).toBe(ConflictDecision.ALLOW);
  });

  it('should BLOCK when cluster exposure limit exceeded', async () => {
    const metalTrades: OpenTradeDTO[] = [
      {
        trade_uid: 'TRD_METAL_001',
        symbol: 'XAGUSD',
        tf: '5m',
        direction: 'CALL',
        expiry_slot_minutes: 5,
        cluster: 'METAL',
      },
      {
        trade_uid: 'TRD_METAL_002',
        symbol: 'XAGUSD',
        tf: '5m',
        direction: 'PUT',
        expiry_slot_minutes: 15,
        cluster: 'METAL',
      },
    ];

    service.setDayCapState({ current_loss_usd: 0, limit_usd: 500 });

    const customLimits = {
      ...DEFAULT_RISK_LIMITS,
      cluster_exposure_limits: { METAL: 60 },
    };

    const request: ConflictCheckRequest = {
      new_signal: mockSignal,
      open_trades: metalTrades,
      scheduled_trades: [],
    };

    const result = await service.checkConflict(request, customLimits);
    expect(result.decision).toBe(ConflictDecision.BLOCK);
    expect(result.reason_codes).toContain('CLUSTER_EXPOSURE_LIMIT_EXCEEDED');
  });

  it('should BLOCK when max_concurrent_trades exceeded', async () => {
    const manyTrades: OpenTradeDTO[] = Array.from({ length: 5 }, (_, i) => ({
      trade_uid: `TRD_MANY_${i}`,
      symbol: 'EURUSD',
      tf: '5m',
      direction: 'CALL',
      expiry_slot_minutes: 5,
      cluster: 'FX_MAJOR',
    }));

    const request: ConflictCheckRequest = {
      new_signal: mockSignal,
      open_trades: manyTrades,
      scheduled_trades: [],
    };

    const result = await service.checkConflict(request, DEFAULT_RISK_LIMITS);
    expect(result.decision).toBe(ConflictDecision.BLOCK);
    expect(result.reason_codes).toContain('MAX_CONCURRENT_TRADES_EXCEEDED');
  });
});
