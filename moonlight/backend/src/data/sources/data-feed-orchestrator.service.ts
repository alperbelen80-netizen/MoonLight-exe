import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IDataFeedAdapter } from './data-feed.interface';
import { MockLiveDataFeedAdapter } from './mock-live-feed.adapter';
import { BinanceCCXTAdapter } from './binance-ccxt.adapter';
import { TradingViewWebhookAdapter } from './tradingview-webhook.adapter';
import { IQOptionAPIAdapter } from './iq-option-api.adapter';

export type DataFeedProvider = 'MOCK_LIVE' | 'BINANCE_CCXT' | 'TRADINGVIEW' | 'IQ_OPTION';

@Injectable()
export class DataFeedOrchestrator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataFeedOrchestrator.name);
  private adapters: Map<DataFeedProvider, IDataFeedAdapter> = new Map();
  private activeProvider: DataFeedProvider;

  constructor() {
    this.activeProvider = (process.env.DATA_FEED_PROVIDER as DataFeedProvider) || 'MOCK_LIVE';

    this.adapters.set('MOCK_LIVE', new MockLiveDataFeedAdapter());
    this.adapters.set('BINANCE_CCXT', new BinanceCCXTAdapter());
    this.adapters.set('TRADINGVIEW', new TradingViewWebhookAdapter());
    this.adapters.set('IQ_OPTION', new IQOptionAPIAdapter());
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`Data Feed Orchestrator initialized with provider: ${this.activeProvider}`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const [provider, adapter] of this.adapters) {
      if (adapter.isConnected()) {
        await adapter.disconnect();
        this.logger.log(`Disconnected ${provider}`);
      }
    }
  }

  getActiveAdapter(): IDataFeedAdapter {
    const adapter = this.adapters.get(this.activeProvider);
    if (!adapter) {
      throw new Error(`Active provider ${this.activeProvider} not found`);
    }
    return adapter;
  }

  getAdapter(provider: DataFeedProvider): IDataFeedAdapter | undefined {
    return this.adapters.get(provider);
  }

  async switchProvider(provider: DataFeedProvider): Promise<void> {
    const currentAdapter = this.getActiveAdapter();
    if (currentAdapter.isConnected()) {
      await currentAdapter.disconnect();
    }

    this.activeProvider = provider;
    this.logger.log(`Switched to provider: ${provider}`);
  }

  getActiveProviderName(): DataFeedProvider {
    return this.activeProvider;
  }

  async getAvailableProviders(): Promise<
    Array<{ name: DataFeedProvider; connected: boolean; symbols: string[] }>
  > {
    const result = [];

    for (const [provider, adapter] of this.adapters) {
      const symbols = await adapter.listSupportedSymbols();
      result.push({
        name: provider,
        connected: adapter.isConnected(),
        symbols,
      });
    }

    return result;
  }
}
