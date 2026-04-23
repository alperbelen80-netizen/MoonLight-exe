import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IDataFeedAdapter } from './data-feed.interface';
import { MockLiveDataFeedAdapter } from './mock-live-feed.adapter';
import { BinanceCCXTAdapter } from './binance-ccxt.adapter';
import { BybitCCXTAdapter } from './bybit-ccxt.adapter';
import { TradingViewWebhookAdapter } from './tradingview-webhook.adapter';
import { IQOptionAPIAdapter } from './iq-option-api.adapter';

export type DataFeedProvider =
  | 'MOCK_LIVE'
  | 'BINANCE_CCXT'
  | 'BYBIT_CCXT'
  | 'TRADINGVIEW'
  | 'IQ_OPTION';

export interface ProviderHealth {
  name: DataFeedProvider;
  connected: boolean;
  latencyMs: number | null;
  lastError: string | null;
  score: number;
  kind: 'LIVE' | 'WEBHOOK' | 'MOCK';
}

/**
 * Multi-provider Data Feed Orchestrator
 *
 * Exposes:
 *  - Active provider switch (switchProvider)
 *  - Parallel health check with latency probes (getProvidersHealth)
 *  - Deterministic best-provider scoring (selectBestProvider) that can
 *    be audited by the AI Coach (fail-closed policy).
 *
 * Scoring (higher = better):
 *    connected ? (100 - min(latency,5000)/50) : -1
 *    MOCK is always considered a safe baseline of 10.
 */
@Injectable()
export class DataFeedOrchestrator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataFeedOrchestrator.name);
  private adapters: Map<DataFeedProvider, IDataFeedAdapter> = new Map();
  private activeProvider: DataFeedProvider;

  constructor() {
    this.activeProvider = (process.env.DATA_FEED_PROVIDER as DataFeedProvider) || 'MOCK_LIVE';

    this.adapters.set('MOCK_LIVE', new MockLiveDataFeedAdapter());
    this.adapters.set('BINANCE_CCXT', new BinanceCCXTAdapter());
    this.adapters.set('BYBIT_CCXT', new BybitCCXTAdapter());
    this.adapters.set('TRADINGVIEW', new TradingViewWebhookAdapter());
    this.adapters.set('IQ_OPTION', new IQOptionAPIAdapter());
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Data Feed Orchestrator initialized (active=${this.activeProvider})`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const [provider, adapter] of this.adapters) {
      if (adapter.isConnected()) {
        try {
          await adapter.disconnect();
          this.logger.log(`Disconnected ${provider}`);
        } catch (err: any) {
          this.logger.warn(`Disconnect failed for ${provider}: ${err?.message}`);
        }
      }
    }
  }

  getActiveAdapter(): IDataFeedAdapter {
    const adapter = this.adapters.get(this.activeProvider);
    if (!adapter) throw new Error(`Active provider ${this.activeProvider} not found`);
    return adapter;
  }

  getAdapter(provider: DataFeedProvider): IDataFeedAdapter | undefined {
    return this.adapters.get(provider);
  }

  async switchProvider(provider: DataFeedProvider): Promise<void> {
    if (!this.adapters.has(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const currentAdapter = this.getActiveAdapter();
    if (currentAdapter.isConnected()) {
      try {
        await currentAdapter.disconnect();
      } catch (err: any) {
        this.logger.warn(`Current provider disconnect failed: ${err?.message}`);
      }
    }
    this.activeProvider = provider;
    this.logger.log(`Switched active provider to ${provider}`);
  }

  getActiveProviderName(): DataFeedProvider {
    return this.activeProvider;
  }

  async getAvailableProviders(): Promise<
    Array<{ name: DataFeedProvider; connected: boolean; symbols: string[] }>
  > {
    const result = [];
    for (const [provider, adapter] of this.adapters) {
      try {
        const symbols = await adapter.listSupportedSymbols();
        result.push({ name: provider, connected: adapter.isConnected(), symbols: symbols.slice(0, 20) });
      } catch (err: any) {
        result.push({ name: provider, connected: false, symbols: [] });
      }
    }
    return result;
  }

  /**
   * Parallel health check across all providers.
   *  - MOCK is always healthy (deterministic baseline).
   *  - BINANCE/BYBIT: one fetchTicker() probe with a 5s timeout.
   *  - TRADINGVIEW: healthy only if at least one handler has been registered.
   *  - IQ_OPTION: uses adapter.isConnected() (skeleton mode stays DOWN).
   */
  async getProvidersHealth(): Promise<ProviderHealth[]> {
    const checks = Array.from(this.adapters.entries()).map(async ([name, adapter]) =>
      this.probeAdapter(name, adapter),
    );

    const results = await Promise.allSettled(checks);

    return results.map((r, idx) => {
      const providerName = Array.from(this.adapters.keys())[idx];
      if (r.status === 'fulfilled') return r.value;
      return {
        name: providerName,
        connected: false,
        latencyMs: null,
        lastError: (r.reason as Error)?.message || 'probe failed',
        score: -1,
        kind: providerName === 'TRADINGVIEW' ? 'WEBHOOK' : providerName === 'MOCK_LIVE' ? 'MOCK' : 'LIVE',
      };
    });
  }

  /**
   * Deterministic scoring: highest score wins. Tie-breaker order:
   *   BYBIT_CCXT > BINANCE_CCXT > TRADINGVIEW > IQ_OPTION > MOCK_LIVE
   *
   * MOCK_LIVE always returns score=10 so it is the last-resort provider
   * when every real source is DOWN (fail-safe baseline instead of outage).
   */
  selectBestProvider(health: ProviderHealth[]): DataFeedProvider {
    const tiePriority: Record<DataFeedProvider, number> = {
      BYBIT_CCXT: 5,
      BINANCE_CCXT: 4,
      TRADINGVIEW: 3,
      IQ_OPTION: 2,
      MOCK_LIVE: 1,
    };

    const sorted = [...health].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (tiePriority[b.name] ?? 0) - (tiePriority[a.name] ?? 0);
    });

    return sorted[0]?.name ?? 'MOCK_LIVE';
  }

  /**
   * Convenience: probe + score + (optional) switch.
   * Callers typically wrap this with an AI validation step before actually
   * switching. We intentionally do NOT perform the switch here – that
   * decision must be gated by a human-visible or AI-validated check.
   */
  async probeAndScore(): Promise<{
    health: ProviderHealth[];
    deterministicChoice: DataFeedProvider;
    active: DataFeedProvider;
  }> {
    const health = await this.getProvidersHealth();
    return {
      health,
      deterministicChoice: this.selectBestProvider(health),
      active: this.activeProvider,
    };
  }

  private async probeAdapter(
    name: DataFeedProvider,
    adapter: IDataFeedAdapter,
  ): Promise<ProviderHealth> {
    // MOCK: always "connected" and healthy.
    if (name === 'MOCK_LIVE') {
      return {
        name,
        connected: true,
        latencyMs: 5,
        lastError: null,
        score: 10,
        kind: 'MOCK',
      };
    }

    // TRADINGVIEW webhook adapter: healthy ONLY if at least one handler is registered.
    if (name === 'TRADINGVIEW') {
      const connected = adapter.isConnected();
      return {
        name,
        connected,
        latencyMs: connected ? 0 : null,
        lastError: connected ? null : 'No webhook handlers registered',
        score: connected ? 50 : -1,
        kind: 'WEBHOOK',
      };
    }

    // CCXT-based adapters: real latency probe with 5s cap.
    if (name === 'BINANCE_CCXT' || name === 'BYBIT_CCXT') {
      const probe = (adapter as any).probe ?? (async () => ({ ok: adapter.isConnected(), latencyMs: 0 }));
      const t0 = Date.now();
      try {
        const result = await Promise.race([
          probe.call(adapter, 'BTCUSDT'),
          new Promise<{ ok: boolean; latencyMs: number; error?: string }>((resolve) =>
            setTimeout(() => resolve({ ok: false, latencyMs: Date.now() - t0, error: 'timeout (>5s)' }), 5000),
          ),
        ]);
        const latencyMs = result.latencyMs;
        const score = result.ok ? Math.max(1, 100 - Math.min(latencyMs, 5000) / 50) : -1;
        return {
          name,
          connected: result.ok,
          latencyMs: Number.isFinite(latencyMs) ? Math.round(latencyMs) : null,
          lastError: result.ok ? null : result.error || 'probe failed',
          score,
          kind: 'LIVE',
        };
      } catch (err: any) {
        return {
          name,
          connected: false,
          latencyMs: Date.now() - t0,
          lastError: err?.message || 'probe error',
          score: -1,
          kind: 'LIVE',
        };
      }
    }

    // IQ_OPTION or other adapters – fallback to isConnected()
    const connected = adapter.isConnected();
    return {
      name,
      connected,
      latencyMs: null,
      lastError: connected ? null : 'Adapter not connected',
      score: connected ? 20 : -1,
      kind: 'LIVE',
    };
  }
}
