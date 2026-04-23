import { Injectable, Logger } from '@nestjs/common';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';

/**
 * Mock Live Feed Adapter (V2.5-1 hardened)
 *
 * Generates synthetic OHLCV candles in-process so the system can exercise the
 * full Signal → Risk → Execution pipeline without any external data provider.
 *
 * V2.5-1 fail-safe changes:
 *  - Seed is emitted in **async chunks** with an event-loop yield so the
 *    bootstrap pump cannot block the main thread (the previous 100-bar
 *    synchronous loop across 12 subscriptions could CPU-lock the process).
 *  - Default interval is **>= 30_000ms** (configurable via MOCK_FEED_INTERVAL_MS).
 *  - Timers are .unref()'d so they never keep Node.js alive during Jest tests.
 *
 * Knobs (env):
 *  - MOCK_FEED_FAST_DEMO (default true): seed 100 historical bars on subscribe
 *  - MOCK_FEED_INTERVAL_MS (default 30000): live tick cadence in fast-demo mode
 *  - MOCK_FEED_SEED_BARS (default 100): history bars at subscribe time
 *  - MOCK_FEED_SEED_CHUNK (default 10): chunk size; we yield the event-loop
 *      after each chunk so seeding never blocks.
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

  private readTickMs(): number {
    const raw = parseInt(process.env.MOCK_FEED_INTERVAL_MS || '30000', 10);
    if (!Number.isFinite(raw) || raw < 500) return 30_000;
    return raw;
  }

  private readSeedBars(): number {
    const raw = parseInt(process.env.MOCK_FEED_SEED_BARS || '100', 10);
    if (!Number.isFinite(raw) || raw < 0) return 100;
    return Math.min(raw, 500); // hard cap
  }

  private readSeedChunk(): number {
    const raw = parseInt(process.env.MOCK_FEED_SEED_CHUNK || '10', 10);
    if (!Number.isFinite(raw) || raw < 1) return 10;
    return raw;
  }

  private yieldEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

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

    const basePrice = this.getBasePrice(symbol);
    let price = basePrice;

    // Chunked async seed (V2.5-1): prevents startup CPU lock.
    if (this.fastDemo) {
      const totalBars = this.readSeedBars();
      const chunkSize = this.readSeedChunk();
      let emitted = 0;

      while (emitted < totalBars) {
        const remain = Math.min(chunkSize, totalBars - emitted);
        for (let j = 0; j < remain; j++) {
          const barIdx = totalBars - emitted - j; // descending i
          const drift = (Math.random() - 0.5) * basePrice * 0.002;
          price = price + drift;
          const open = price;
          const close = price + (Math.random() - 0.5) * basePrice * 0.0015;
          const high = Math.max(open, close) + Math.random() * basePrice * 0.0008;
          const low = Math.min(open, close) - Math.random() * basePrice * 0.0008;
          const ts = new Date(Date.now() - barIdx * 60_000);
          try {
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
          } catch (err) {
            this.logger.warn(
              `seed handler error for ${key}: ${(err as Error).message}`,
            );
          }
          price = close;
        }
        emitted += remain;
        // Yield to event-loop so Nest lifecycle hooks + HTTP server can proceed.
        await this.yieldEventLoop();
      }

      this.logger.log(`Seeded ${key} with ${emitted} historical bars (chunked)`);
    }

    const intervalMs = this.fastDemo ? this.readTickMs() : this.getIntervalMs(timeframe);
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

      try {
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
      } catch (err) {
        this.logger.warn(
          `tick handler error for ${key}: ${(err as Error).message}`,
        );
      }
    }, intervalMs);

    // Don't block Node.js exit / Jest teardown on this timer.
    if (typeof (interval as unknown as { unref?: () => void }).unref === 'function') {
      (interval as unknown as { unref: () => void }).unref();
    }

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

  /** Test helper: how many active subscriptions are currently held. */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
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
