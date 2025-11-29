import { Test, TestingModule } from '@nestjs/testing';
import { EVVetoSlotEngine } from '../../../strategy/evvetoslot/evvetoslot-engine.service';
import { CanonicalSignalDTO, SignalDirection, Environment } from '../../../shared/dto/canonical-signal.dto';
import { SlotDecision } from '../../../strategy/evvetoslot/evvetoslot.types';

describe('EVVetoSlotEngine', () => {
  let engine: EVVetoSlotEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EVVetoSlotEngine],
    }).compile();

    engine = module.get<EVVetoSlotEngine>(EVVetoSlotEngine);
  });

  const createMockSignal = (ev: number, confidence: number): CanonicalSignalDTO => ({
    signal_id: 'SIG_TEST',
    idempotency_key: 'hash',
    source: 'test',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: new Date().toISOString(),
    direction: SignalDirection.CALL,
    ev,
    confidence_score: confidence,
    valid_until: new Date(Date.now() + 60000).toISOString(),
    latency_budget_ms: 200,
    schema_version: 1,
    environment: Environment.BACKTEST,
  });

  it('should select best slot for valid signal', () => {
    const signal = createMockSignal(0.06, 0.70);

    const result = engine.selectSlotForSignal(signal);

    expect(result.decision).toBe(SlotDecision.ACCEPT);
    expect(result.selected_expiry_minutes).toBeGreaterThan(0);
    expect(result.expected_ev).toBeGreaterThan(0);
  });

  it('should reject signal with EV too low', () => {
    const signal = createMockSignal(0.01, 0.70);

    const result = engine.selectSlotForSignal(signal);

    expect(result.decision).toBe(SlotDecision.REJECT);
    expect(result.reason_codes).toContain('EV_TOO_LOW');
  });

  it('should reject signal with confidence too low', () => {
    const signal = createMockSignal(0.06, 0.40);

    const result = engine.selectSlotForSignal(signal);

    expect(result.decision).toBe(SlotDecision.REJECT);
    expect(result.reason_codes).toContain('CONFIDENCE_TOO_LOW');
  });

  it('should select highest EV slot from multiple options', () => {
    const signal = createMockSignal(0.08, 0.75);

    const result = engine.selectSlotForSignal(signal);

    expect(result.decision).toBe(SlotDecision.ACCEPT);
    expect(result.selected_expiry_minutes).toBeGreaterThan(0);
  });
});
