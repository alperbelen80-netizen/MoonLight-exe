import { Test, TestingModule } from '@nestjs/testing';
import { ARTEngineService } from '../../../risk/art-engine/art-engine.service';
import {
  CanonicalSignalDTO,
  SignalDirection,
  Environment,
  UncertaintyLevel,
} from '../../../shared/dto/canonical-signal.dto';
import { ARTDecision } from '../../../shared/dto/atomic-risk-token.dto';
import { DEFAULT_RISK_LIMITS } from '../../../risk/models/risk-limits.model';
import { verifyARTSignature } from '../../../risk/art-engine/art-crypto.util';

describe('ARTEngineService', () => {
  let service: ARTEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ARTEngineService],
    }).compile();

    service = module.get<ARTEngineService>(ARTEngineService);
    service.setDayCapState({ current_loss_usd: 0, limit_usd: 500 });
  });

  const mockSignal: CanonicalSignalDTO = {
    signal_id: 'SIG_TEST_001',
    idempotency_key: 'hash_test_001',
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
    environment: Environment.BACKTEST,
  };

  it('should issue ART with decision ACCEPT when DayCap OK', async () => {
    const art = await service.requestART(mockSignal, DEFAULT_RISK_LIMITS);

    expect(art.decision).toBe(ARTDecision.ACCEPT);
    expect(art.approved_stake).toBe(25.0);
    expect(art.signal_id).toBe('SIG_TEST_001');
    expect(art.signature).toBeDefined();
    expect(art.signature.length).toBeGreaterThan(0);
  });

  it('should issue ART with decision REJECT when DayCap exceeded', async () => {
    service.setDayCapState({ current_loss_usd: 510, limit_usd: 500 });

    const art = await service.requestART(mockSignal, DEFAULT_RISK_LIMITS);

    expect(art.decision).toBe(ARTDecision.REJECT);
    expect(art.approved_stake).toBe(0);
    expect(art.reason_codes).toContain('DAYCAP_EXCEEDED');
  });

  it('should issue ART with decision SCALE_DOWN when stake exceeds max_lot', async () => {
    const highStakeSignal: CanonicalSignalDTO = {
      ...mockSignal,
      requested_stake: 100.0,
    };

    const art = await service.requestART(highStakeSignal, DEFAULT_RISK_LIMITS);

    expect(art.decision).toBe(ARTDecision.SCALE_DOWN);
    expect(art.approved_stake).toBe(DEFAULT_RISK_LIMITS.max_lot_per_symbol_usd);
    expect(art.reason_codes).toContain('MAX_LOT_SCALED_DOWN');
  });

  it('should produce valid HMAC signature', async () => {
    const art = await service.requestART(mockSignal, DEFAULT_RISK_LIMITS);

    const isValid = verifyARTSignature(art);
    expect(isValid).toBe(true);
  });

  it('should track DayCap state correctly', () => {
    const state = service.getDayCapState();
    expect(state.current_loss_usd).toBe(0);
    expect(state.limit_usd).toBe(500);

    service.setDayCapState({ current_loss_usd: 120, limit_usd: 500 });
    const updatedState = service.getDayCapState();
    expect(updatedState.current_loss_usd).toBe(120);
  });
});
