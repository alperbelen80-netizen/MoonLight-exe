import { CanonicalSignalDTO, SignalDirection, Environment, UncertaintyLevel } from '../../../shared/dto/canonical-signal.dto';
import { validateCanonicalSignal } from '../../../shared/utils/signal-validation.util';

describe('CanonicalSignalDTO Validation', () => {
  const validSignal: CanonicalSignalDTO = {
    signal_id: 'SIG_2025_01_18_10_00_001',
    idempotency_key: 'hash_abc123',
    source: 'strategy_slot_42',
    strategy_id: 'STRATEGY_01_BB_RSI',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: '2025-01-18T10:00:00.123Z',
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

  it('should validate a correct signal', async () => {
    const result = await validateCanonicalSignal(validSignal);
    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject signal with missing required field (symbol)', async () => {
    const invalidSignal = { ...validSignal };
    delete (invalidSignal as any).symbol;

    const result = await validateCanonicalSignal(invalidSignal as CanonicalSignalDTO);
    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes('symbol'))).toBe(true);
  });

  it('should reject signal with invalid tf (3x)', async () => {
    const invalidSignal: CanonicalSignalDTO = {
      ...validSignal,
      tf: '3x' as any,
    };

    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject signal with ev > 1.0', async () => {
    const invalidSignal: CanonicalSignalDTO = {
      ...validSignal,
      ev: 1.5,
    };

    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
  });

  it('should reject signal with lowercase symbol', async () => {
    const invalidSignal: CanonicalSignalDTO = {
      ...validSignal,
      symbol: 'xauusd' as any,
    };

    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
  });
});
