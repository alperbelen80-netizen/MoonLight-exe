import { Test } from '@nestjs/testing';
import { BrokerAdapterRegistry } from '../../../broker/adapters/broker-adapter.registry';
import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';
import { FakeBrokerAdapter } from '../../../broker/adapters/fake-broker.adapter';
import { IQOptionRealAdapter } from '../../../broker/adapters/iq-option-real.adapter';
import { OlympTradePGSAdapter } from '../../../broker/adapters/olymp-trade-pgs.adapter';
import { BinomoProtocolAdapter } from '../../../broker/adapters/binomo-protocol.adapter';
import { ExpertOptionHighFreqAdapter } from '../../../broker/adapters/expert-option-highfreq.adapter';

describe('BrokerAdapterRegistry', () => {
  let registry: BrokerAdapterRegistry;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BrokerCredentialsService,
        FakeBrokerAdapter,
        IQOptionRealAdapter,
        OlympTradePGSAdapter,
        BinomoProtocolAdapter,
        ExpertOptionHighFreqAdapter,
        BrokerAdapterRegistry,
      ],
    }).compile();
    registry = moduleRef.get(BrokerAdapterRegistry);
  });

  it('registers all 5 broker adapters', () => {
    const ids = registry.listIds();
    expect(ids).toContain('FAKE');
    expect(ids).toContain('IQ_OPTION');
    expect(ids).toContain('OLYMP_TRADE');
    expect(ids).toContain('BINOMO');
    expect(ids).toContain('EXPERT_OPTION');
    expect(ids.length).toBe(5);
  });

  it('resolves each adapter via get()', () => {
    expect(registry.get('FAKE').getBrokerId()).toBe('FAKE');
    expect(registry.get('IQ_OPTION').getBrokerId()).toBe('IQ_OPTION');
    expect(registry.get('OLYMP_TRADE').getBrokerId()).toBe('OLYMP_TRADE');
    expect(registry.get('BINOMO').getBrokerId()).toBe('BINOMO');
    expect(registry.get('EXPERT_OPTION').getBrokerId()).toBe('EXPERT_OPTION');
  });

  it('returns health snapshot with all adapters', () => {
    const snap = registry.getHealthSnapshot();
    expect(snap.length).toBe(5);
    snap.forEach((s) => {
      expect(s.brokerId).toBeTruthy();
      expect(['UP', 'DOWN', 'DEGRADED', 'RECONNECTING', 'COOLDOWN']).toContain(s.health);
    });
  });

  it('throws when resolving unknown broker id', () => {
    // @ts-expect-error - purposely passing invalid id
    expect(() => registry.get('UNKNOWN')).toThrow('Broker adapter not found');
  });
});
