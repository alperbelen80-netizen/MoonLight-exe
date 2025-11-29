import { CanonicalSignalDTO, SignalDirection, Environment, UncertaintyLevel } from '../../../shared/dto/canonical-signal.dto';
import { validateCanonicalSignal } from '../../../shared/utils/signal-validation.util';

describe('CanonicalSignalDTO Validation', () => {
  it('should validate a correct signal', async () => {
    const validSignal = Object.assign(new CanonicalSignalDTO(), {
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
    });

    const result = await validateCanonicalSignal(validSignal);
    expect(result.ok).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject signal with missing required field (symbol)', async () => {
    const invalidData = {
      signal_id: 'SIG_TEST',
      idempotency_key: 'hash',
      source: 'test',
      tf: '1m',
      ts: '2025-01-18T10:00:00Z',
      direction: SignalDirection.CALL,
      ev: 0.5,
      confidence_score: 0.7,
      valid_until: '2025-01-18T10:01:00Z',
      latency_budget_ms: 200,
      schema_version: 1,
      environment: Environment.LIVE,
    };

    const invalidSignal = Object.assign(new CanonicalSignalDTO(), invalidData);
    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject signal with invalid tf', async () => {
    const invalidData = {
      signal_id: 'SIG_TEST',
      idempotency_key: 'hash',
      source: 'test',
      symbol: 'XAUUSD',
      tf: '3x',
      ts: '2025-01-18T10:00:00Z',
      direction: SignalDirection.CALL,
      ev: 0.5,
      confidence_score: 0.7,
      valid_until: '2025-01-18T10:01:00Z',
      latency_budget_ms: 200,
      schema_version: 1,
      environment: Environment.LIVE,
    };

    const invalidSignal = Object.assign(new CanonicalSignalDTO(), invalidData);
    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
  });

  it('should reject signal with ev > 1.0', async () => {
    const invalidData = {
      signal_id: 'SIG_TEST',
      idempotency_key: 'hash',
      source: 'test',
      symbol: 'XAUUSD',
      tf: '1m',
      ts: '2025-01-18T10:00:00Z',
      direction: SignalDirection.CALL,
      ev: 1.5,
      confidence_score: 0.7,
      valid_until: '2025-01-18T10:01:00Z',
      latency_budget_ms: 200,
      schema_version: 1,
      environment: Environment.LIVE,
    };

    const invalidSignal = Object.assign(new CanonicalSignalDTO(), invalidData);
    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
  });

  it('should reject signal with lowercase symbol', async () => {
    const invalidData = {
      signal_id: 'SIG_TEST',
      idempotency_key: 'hash',
      source: 'test',
      symbol: 'xauusd',
      tf: '1m',
      ts: '2025-01-18T10:00:00Z',
      direction: SignalDirection.CALL,
      ev: 0.5,
      confidence_score: 0.7,
      valid_until: '2025-01-18T10:01:00Z',
      latency_budget_ms: 200,
      schema_version: 1,
      environment: Environment.LIVE,
    };

    const invalidSignal = Object.assign(new CanonicalSignalDTO(), invalidData);
    const result = await validateCanonicalSignal(invalidSignal);
    expect(result.ok).toBe(false);
  });
});
