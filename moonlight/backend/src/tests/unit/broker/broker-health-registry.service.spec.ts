import { BrokerHealthRegistryService, BrokerId, BrokerState } from '../../../broker/health/broker-health-registry.service';

describe('BrokerHealthRegistryService', () => {
  let svc: BrokerHealthRegistryService;

  beforeEach(() => {
    svc = new BrokerHealthRegistryService();
  });

  it('seeds 5 brokers with initial states', () => {
    const list = svc.list();
    expect(list.length).toBe(5);
    const fake = svc.get('FAKE');
    expect(fake?.state).toBe('READY');
    const iq = svc.get('IQ_OPTION');
    expect(iq?.state).toBe('DISCONNECTED');
  });

  it('accepts a valid transition DISCONNECTED → CONNECTING', () => {
    const ok = svc.transition('IQ_OPTION', 'CONNECTING', 'user requested');
    expect(ok).toBe(true);
    expect(svc.get('IQ_OPTION')?.state).toBe('CONNECTING');
    expect(svc.get('IQ_OPTION')?.reason).toBe('user requested');
  });

  it('rejects an invalid transition DISCONNECTED → READY', () => {
    const ok = svc.transition('IQ_OPTION', 'READY');
    expect(ok).toBe(false);
    expect(svc.get('IQ_OPTION')?.state).toBe('DISCONNECTED');
  });

  it('idempotent self-transitions succeed and update reason', () => {
    svc.transition('IQ_OPTION', 'CONNECTING');
    const ok = svc.transition('IQ_OPTION', 'CONNECTING', 'retrying');
    expect(ok).toBe(true);
    expect(svc.get('IQ_OPTION')?.reason).toBe('retrying');
  });

  it('walks full happy-path: CONNECTING → AUTHENTICATING → READY', () => {
    const path: BrokerState[] = ['CONNECTING', 'AUTHENTICATING', 'READY'];
    for (const state of path) {
      expect(svc.transition('OLYMP_TRADE', state)).toBe(true);
    }
    expect(svc.get('OLYMP_TRADE')?.state).toBe('READY');
  });

  it('increments errorsLastHour on ERRORED transition', () => {
    svc.transition('BINOMO', 'CONNECTING');
    svc.transition('BINOMO', 'ERRORED', 'tcp reset');
    const list = svc.list();
    const b = list.find((x) => x.brokerId === 'BINOMO')!;
    expect(b.errorsLastHour).toBe(1);
  });

  it('recordQuoteSeen stamps quotesLastSeenAt', () => {
    svc.recordQuoteSeen('FAKE');
    expect(svc.get('FAKE')?.quotesLastSeenAt).toBeDefined();
  });

  it('recordOrderLatency rounds to integer ms', () => {
    svc.recordOrderLatency('FAKE', 123.9);
    expect(svc.get('FAKE')?.orderLatencyMsP95).toBe(124);
  });

  it('returns null for unknown broker', () => {
    expect(svc.get('UNKNOWN' as BrokerId)).toBeNull();
  });
});
