import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { IQOptionRealAdapter } from './iq-option-real.adapter';
import { OlympTradePGSAdapter } from './olymp-trade-pgs.adapter';
import { BinomoProtocolAdapter } from './binomo-protocol.adapter';
import { ExpertOptionHighFreqAdapter } from './expert-option-highfreq.adapter';
import { FakeBrokerAdapter } from './fake-broker.adapter';

export type SupportedBrokerId =
  | 'FAKE'
  | 'IQ_OPTION'
  | 'OLYMP_TRADE'
  | 'BINOMO'
  | 'EXPERT_OPTION';

/**
 * BrokerAdapterRegistry
 *
 * Central lookup for all available broker adapters. The MultiBrokerRouter
 * consumes this registry to select and route orders. Adapters are singletons
 * created by the Nest DI container.
 */
@Injectable()
export class BrokerAdapterRegistry {
  private readonly logger = new Logger(BrokerAdapterRegistry.name);
  private readonly adapters: Map<SupportedBrokerId, BrokerAdapterInterface> = new Map();

  constructor(
    @Inject(FakeBrokerAdapter) fake: FakeBrokerAdapter,
    @Inject(IQOptionRealAdapter) iq: IQOptionRealAdapter,
    @Inject(OlympTradePGSAdapter) olymp: OlympTradePGSAdapter,
    @Inject(BinomoProtocolAdapter) binomo: BinomoProtocolAdapter,
    @Inject(ExpertOptionHighFreqAdapter) expert: ExpertOptionHighFreqAdapter,
  ) {
    this.adapters.set('FAKE', fake);
    this.adapters.set('IQ_OPTION', iq);
    this.adapters.set('OLYMP_TRADE', olymp);
    this.adapters.set('BINOMO', binomo);
    this.adapters.set('EXPERT_OPTION', expert);

    this.logger.log(
      `BrokerAdapterRegistry initialized with ${this.adapters.size} adapters: ${Array.from(this.adapters.keys()).join(', ')}`,
    );
  }

  get(brokerId: SupportedBrokerId): BrokerAdapterInterface {
    const adapter = this.adapters.get(brokerId);
    if (!adapter) {
      throw new Error(`Broker adapter not found: ${brokerId}`);
    }
    return adapter;
  }

  list(): BrokerAdapterInterface[] {
    return Array.from(this.adapters.values());
  }

  listIds(): SupportedBrokerId[] {
    return Array.from(this.adapters.keys());
  }

  getHealthSnapshot(): Array<{ brokerId: string; health: string; latencyMs: number | null }> {
    return this.list().map((a) => ({
      brokerId: a.getBrokerId(),
      health: a.getSessionHealth(),
      latencyMs: a.getLastLatencyMs ? (a.getLastLatencyMs() ?? null) : null,
    }));
  }
}
