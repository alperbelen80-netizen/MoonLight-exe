import { Test, TestingModule } from '@nestjs/testing';
import { PackFactoryService } from '../../../strategy/pack-factory/pack-factory.service';
import { CanonicalSignalDTO, SignalDirection, Environment } from '../../../shared/dto/canonical-signal.dto';

describe('PackFactoryService', () => {
  let service: PackFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackFactoryService],
    }).compile();

    service = module.get<PackFactoryService>(PackFactoryService);
  });

  const createSignal = (strategyId: string, ev: number, confidence: number): CanonicalSignalDTO => ({
    signal_id: `SIG_${strategyId}`,
    idempotency_key: 'hash',
    source: strategyId,
    strategy_id: strategyId,
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

  it('should select highest scoring signal from pack', () => {
    const signals = [
      createSignal('bb_rsi_buy_v1', 0.05, 0.70),
      createSignal('bb_rsi_sell_v1', 0.04, 0.65),
    ];

    const result = service.evaluatePackSignals('PACK_DEFAULT', signals);

    expect(result.selected_signal).toBeDefined();
    expect(result.selected_signal.signal_id).toBe('SIG_bb_rsi_buy_v1');
  });

  it('should return null for unknown pack', () => {
    const signals = [createSignal('test', 0.05, 0.70)];

    const result = service.evaluatePackSignals('UNKNOWN_PACK', signals);

    expect(result.selected_signal).toBeNull();
    expect(result.reason_codes).toContain('PACK_NOT_FOUND');
  });

  it('should handle empty signals array', () => {
    const result = service.evaluatePackSignals('PACK_DEFAULT', []);

    expect(result.selected_signal).toBeNull();
    expect(result.reason_codes).toContain('NO_SIGNALS');
  });
});
