import {
  SimulatedBrokerAdapter,
  BrokerSimRegistry,
  DEFAULT_SIM_PROFILES,
} from '../../../broker/adapters/simulated/simulated-broker.adapter';
import { BrokerHealthRegistryService } from '../../../broker/health/broker-health-registry.service';
import {
  BrokerOrderRequestDTO,
  BrokerOrderStatus,
} from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../../shared/enums/session-health.enum';

function baseRequest(overrides: Partial<BrokerOrderRequestDTO> = {}): BrokerOrderRequestDTO {
  return {
    broker_request_id: `req_${Math.random()}`,
    order_key: 'k1',
    symbol: 'EURUSD',
    direction: SignalDirection.CALL,
    stake_amount: 10,
    expiry_minutes: 1,
    art_id: 'ART_1',
    account_id: 'ACC_DEMO',
    request_ts_utc: new Date().toISOString(),
    ...overrides,
  };
}

describe('SimulatedBrokerAdapter (V2.5-2) contract', () => {
  let health: BrokerHealthRegistryService;

  beforeEach(() => {
    health = new BrokerHealthRegistryService();
  });

  it('identifies with the requested broker id and exposes profile', () => {
    const iq = new SimulatedBrokerAdapter('IQ_OPTION', health, 1);
    expect(iq.getBrokerId()).toBe('IQ_OPTION');
    expect(iq.snapshot().profile.payoutBase).toBe(
      DEFAULT_SIM_PROFILES.IQ_OPTION.payoutBase,
    );
  });

  it('connect → auth → ready transitions in BrokerHealthRegistry', async () => {
    const adapter = new SimulatedBrokerAdapter('OLYMP_TRADE', health, 10);
    expect(health.get('OLYMP_TRADE')?.state).toBe('DISCONNECTED');
    await adapter.connectSession('ACC_1');
    expect(adapter.getSessionHealth()).toBe(SessionHealth.UP);
    expect(health.get('OLYMP_TRADE')?.state).toBe('READY');
  });

  it('rejects orders with SESSION_DOWN when not connected', async () => {
    const adapter = new SimulatedBrokerAdapter('BINOMO', health, 5);
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('SESSION_DOWN');
  });

  it('given identical seeds two adapters produce identical order sequences', async () => {
    const a = new SimulatedBrokerAdapter('IQ_OPTION', null, 999);
    const b = new SimulatedBrokerAdapter('IQ_OPTION', null, 999);
    await a.connectSession('X');
    await b.connectSession('X');

    const seq = Array.from({ length: 50 }, (_, i) =>
      baseRequest({ broker_request_id: `req_${i}`, stake_amount: 5 + (i % 4) }),
    );

    const acksA = [];
    const acksB = [];
    for (const r of seq) {
      acksA.push(await a.sendOrder(r));
      acksB.push(await b.sendOrder(r));
    }

    // Status sequence must match bit-for-bit (deterministic PRNG).
    expect(acksA.map((x) => x.status)).toEqual(acksB.map((x) => x.status));
    // Latencies must match.
    expect(acksA.map((x) => x.latency_ms)).toEqual(acksB.map((x) => x.latency_ms));
    // Open prices (when ack) must match.
    expect(acksA.map((x) => x.open_price ?? null)).toEqual(
      acksB.map((x) => x.open_price ?? null),
    );
  });

  it('different brokers with same input produce different behaviors (identity)', async () => {
    const iq = new SimulatedBrokerAdapter('IQ_OPTION', null, 1);
    const binomo = new SimulatedBrokerAdapter('BINOMO', null, 1);
    await iq.connectSession('X');
    await binomo.connectSession('X');

    const iqAcks = [];
    const binomoAcks = [];
    for (let i = 0; i < 25; i++) {
      iqAcks.push(await iq.sendOrder(baseRequest({ broker_request_id: `r${i}` })));
      binomoAcks.push(await binomo.sendOrder(baseRequest({ broker_request_id: `r${i}` })));
    }
    // With different profiles (and default different internal seeds) the
    // latency distributions should clearly differ.
    const iqAvg =
      iqAcks.reduce((s, a) => s + (a.latency_ms || 0), 0) / iqAcks.length;
    const bAvg =
      binomoAcks.reduce((s, a) => s + (a.latency_ms || 0), 0) / binomoAcks.length;
    // IQ is configured faster than BINOMO — they must not coincide.
    expect(iqAvg).toBeLessThan(bAvg);
  });

  it('reject rate is bounded by profile.rejectionProb (+ timeouts)', async () => {
    const adapter = new SimulatedBrokerAdapter('FAKE', null, 1);
    // FAKE profile has rejectionProb = 0, so 0 rejections / timeouts expected.
    await adapter.connectSession('X');
    const acks = [];
    for (let i = 0; i < 100; i++) {
      acks.push(await adapter.sendOrder(baseRequest({ broker_request_id: `r${i}` })));
    }
    const rejectCount = acks.filter(
      (a) => a.status !== BrokerOrderStatus.ACK,
    ).length;
    expect(rejectCount).toBe(0);
  });

  it('reset() zeroes counters AND replays identical output', async () => {
    const adapter = new SimulatedBrokerAdapter('IQ_OPTION', null, 777);
    await adapter.connectSession('X');

    const reqs = Array.from({ length: 30 }, (_, i) =>
      baseRequest({ broker_request_id: `r${i}` }),
    );
    const acks1 = [];
    for (const r of reqs) acks1.push(await adapter.sendOrder(r));

    adapter.reset();
    expect(adapter.snapshot().ordersSent).toBe(0);
    expect(adapter.snapshot().ordersAck).toBe(0);
    await adapter.connectSession('X');

    const acks2 = [];
    for (const r of reqs) acks2.push(await adapter.sendOrder(r));
    expect(acks1.map((a) => a.status)).toEqual(acks2.map((a) => a.status));
    expect(acks1.map((a) => a.latency_ms)).toEqual(acks2.map((a) => a.latency_ms));
  });

  it('configure({seed,profile}) reseeds and applies overrides', async () => {
    const adapter = new SimulatedBrokerAdapter('EXPERT_OPTION', null, 1);
    const snap1 = adapter.configure({
      seed: 99,
      profile: { rejectionProb: 0 },
      reset: true,
    });
    expect(snap1.seed).toBe(99);
    expect(snap1.profile.rejectionProb).toBe(0);

    await adapter.connectSession('X');
    const acks = [];
    for (let i = 0; i < 20; i++) {
      acks.push(await adapter.sendOrder(baseRequest({ broker_request_id: `r${i}` })));
    }
    // rejectionProb is now 0; no reject or timeout should occur.
    expect(acks.every((a) => a.status === BrokerOrderStatus.ACK)).toBe(true);
  });

  it('getPayoutRatio is deterministic per (symbol, expiry) + brokerId + seed', async () => {
    const a = new SimulatedBrokerAdapter('OLYMP_TRADE', null, 42);
    const b = new SimulatedBrokerAdapter('OLYMP_TRADE', null, 42);
    const pA1 = await a.getPayoutRatio('EURUSD', 1);
    const pA2 = await a.getPayoutRatio('EURUSD', 1);
    const pB = await b.getPayoutRatio('EURUSD', 1);
    const pOther = await a.getPayoutRatio('XAUUSD', 1);
    expect(pA1).toBe(pA2);
    expect(pA1).toBe(pB);
    expect(pA1).not.toBe(pOther);
    expect(pA1).toBeGreaterThan(0);
    expect(pA1).toBeLessThanOrEqual(1);
  });

  it('BrokerSimRegistry aggregates adapters + resetAll() works', () => {
    const registry = new BrokerSimRegistry();
    const iq = new SimulatedBrokerAdapter('IQ_OPTION', health, 1);
    const olymp = new SimulatedBrokerAdapter('OLYMP_TRADE', health, 2);
    registry.register(iq);
    registry.register(olymp);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('IQ_OPTION')).toBe(iq);
    const resets = registry.resetAll();
    expect(resets).toHaveLength(2);
    expect(resets.every((r) => r.ordersSent === 0)).toBe(true);
  });
});
