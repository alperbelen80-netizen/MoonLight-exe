import { Injectable, Logger } from '@nestjs/common';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';

/**
 * Mock Live Feed Adapter
 *
 * Generates synthetic OHLCV candles in-process so the system can exercise the
 * full Signal → Risk → Execution pipeline without any external data provider
 * (useful in sandbox mode or behind restrictive firewalls / geo-blocks).
 *
 * Two knobs:
 *  - MOCK_FEED_FAST_DEMO=true  → emits candles every 1–2s (demo mode)
 *  - MOCK_FEED_FAST_DEMO=false → emits candles at the real TF cadence (60s/5m/...)
 *
 * When running in fast demo mode, each subscription seeds its buffer with a
 * 100-bar random-walk history so indicator strategies (RSI-14, MACD, etc.)
 * can start producing signals immediately instead of waiting hours.
 */
@Injectable()
export class MockLiveDataFeedAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(MockLiveDataFeedAdapter.name);
  private subscriptions: Map<
    string,
    { interval: NodeJS.Timeout; handler: CandleHandler; lastClose: number }
  > = new Map();
  private connected = false;

  private readonly fastDemo = process.env.MOCK_FEED_FAST_DEMO !== 'false';

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

    // Seed a realistic random-walk history so indicators have enough bars
    // to evaluate from the very first emitted live candle.
    const basePrice = this.getBasePrice(symbol);
    let price = basePrice;

    if (this.fastDemo) {
      for (let i = 100; i > 0; i--) {
        const drift = (Math.random() - 0.5) * basePrice * 0.002;
        price = price + drift;
        const open = price;
        const close = price + (Math.random() - 0.5) * basePrice * 0.0015;
        const high = Math.max(open, close) + Math.random() * basePrice * 0.0008;
        const low = Math.min(open, close) - Math.random() * basePrice * 0.0008;
        const ts = new Date(Date.now() - i * 60_000);
        handler({
          symbol,
          timeframe,
          timestamp: ts,
          open,
          high,
          low,
          close,
          volume: 800 + Math.random() * 1200,
        });
        price = close;
      }
      this.logger.log(`Seeded ${key} with 100 historical bars`);
    }

    const intervalMs = this.fastDemo ? 1500 : this.getIntervalMs(timeframe);
    const lastClose = price;

    const interval = setInterval(() => {
      const sub = this.subscriptions.get(key);
      if (!sub) return;
      const drift = (Math.random() - 0.5) * basePrice * 0.002;
      const nextClose = sub.lastClose + drift;
      const open = sub.lastClose;
      const close = nextClose;
      const high = Math.max(open, close) + Math.random() * basePrice * 0.0008;
      const low = Math.min(open, close) - Math.random() * basePrice * 0.0008;

      sub.lastClose = close;

      handler({
        symbol,
        timeframe,
        timestamp: new Date(),
        open,
        high,
        low,
        close,
        volume: 800 + Math.random() * 1200,
      });
    }, intervalMs);

    this.subscriptions.set(key, { interval, handler, lastClose });

    this.logger.log(
      `Subscribed to ${key} (mock ${this.fastDemo ? 'FAST_DEMO' : 'real-time'}, tick=${intervalMs}ms, base=${basePrice})`,
    );
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
    return ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHUSDT'];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    for (const [, sub] of this.subscriptions) {
      clearInterval(sub.interval);
    }
    this.subscriptions.clear();
    this.connected = false;
    this.logger.log('Mock data feed disconnected');
  }

  private getBasePrice(symbol: string): number {
    const map: Record<string, number> = {
      BTCUSD: 68500,
      BTCUSDT: 68500,
      ETHUSD: 3420,
      ETHUSDT: 3420,
      XAUUSD: 2035,
      EURUSD: 1.08,
      GBPUSD: 1.27,
      AUDUSD: 0.65,
      USDJPY: 152.5,
      USDCAD: 1.37,
    };
    return map[symbol] ?? 100;
  }

  private getIntervalMs(timeframe: string): number {
    const map: Record<string, number> = {
      '1m': 60_000,
      '5m': 300_000,
      '15m': 900_000,
      '1h': 3_600_000,
    };
    return map[timeframe] || 60_000;
  }
}
