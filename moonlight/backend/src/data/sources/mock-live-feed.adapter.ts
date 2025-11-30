import { Injectable, Logger } from '@nestjs/common';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';

@Injectable()
export class MockLiveDataFeedAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(MockLiveDataFeedAdapter.name);
  private subscriptions: Map<string, { interval: NodeJS.Timeout; handler: CandleHandler }> = new Map();
  private connected = false;

  async subscribeToCandles(
    symbol: string,
    timeframe: string,
    handler: CandleHandler,
  ): Promise<void> {
    const key = `${symbol}_${timeframe}`;

    if (this.subscriptions.has(key)) {
      this.logger.warn(`Already subscribed to ${key}`);
      return;
    }

    this.connected = true;

    const intervalMs = this.getIntervalMs(timeframe);

    const interval = setInterval(() => {
      const mockCandle: CandleData = {
        symbol,
        timeframe,
        timestamp: new Date(),
        open: 2000 + Math.random() * 100,
        high: 2050 + Math.random() * 100,
        low: 1950 + Math.random() * 100,
        close: 2000 + Math.random() * 100,
        volume: 1000 + Math.random() * 500,
      };

      handler(mockCandle);
    }, intervalMs);

    this.subscriptions.set(key, { interval, handler });

    this.logger.log(`Subscribed to ${key} (mock data, interval: ${intervalMs}ms)`);
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    const sub = this.subscriptions.get(key);

    if (sub) {
      clearInterval(sub.interval);
      this.subscriptions.delete(key);
      this.logger.log(`Unsubscribed from ${key}`);
    }
  }

  async listSupportedSymbols(): Promise<string[]> {
    return ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD'];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    for (const [key, sub] of this.subscriptions) {
      clearInterval(sub.interval);
    }
    this.subscriptions.clear();
    this.connected = false;
    this.logger.log('Mock data feed disconnected');
  }

  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
    };
    return map[timeframe] || 60000;
  }
}
