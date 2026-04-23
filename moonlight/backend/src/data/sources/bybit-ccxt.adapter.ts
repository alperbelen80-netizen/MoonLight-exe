import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';

/**
 * Bybit CCXT Adapter
 *
 * Drop-in replacement for Binance when the Binance API is blocked by
 * geo-restrictions (HTTP 451). Bybit is generally accessible from a
 * wider set of regions and exposes a compatible OHLCV feed through CCXT.
 *
 * Behavior matches the Binance adapter: polling-based candle fetch at
 * the timeframe cadence with graceful error handling (errors never
 * crash the subscription loop – adapter reports DOWN via isConnected()).
 */
@Injectable()
export class BybitCCXTAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(BybitCCXTAdapter.name);
  private exchange: ccxt.bybit;
  private subscriptions: Map<string, NodeJS.Timeout> = new Map();
  private connected = false;
  private lastError: string | null = null;
  private lastSuccessTs: number | null = null;
  private lastLatencyMs: number | null = null;

  constructor() {
    this.exchange = new ccxt.bybit({
      enableRateLimit: true,
      options: {
        defaultType: 'linear',
      },
    });
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

    const ccxtSymbol = this.convertSymbol(symbol);

    const fetchAndNotify = async () => {
      const t0 = Date.now();
      try {
        const ohlcv = await this.exchange.fetchOHLCV(ccxtSymbol, timeframe, undefined, 1);
        this.lastLatencyMs = Date.now() - t0;
        this.lastSuccessTs = Date.now();
        this.lastError = null;
        this.connected = true;

        if (ohlcv && ohlcv.length > 0) {
          const [timestamp, open, high, low, close, volume] = ohlcv[0];
          handler({
            symbol,
            timeframe,
            timestamp: new Date(timestamp),
            open: Number(open),
            high: Number(high),
            low: Number(low),
            close: Number(close),
            volume: Number(volume),
          });
        }
      } catch (error: any) {
        this.lastError = error?.message || String(error);
        this.logger.error(`Error fetching candle for ${key}: ${this.lastError}`);
      }
    };

    // Initial fetch to set first connection state
    await fetchAndNotify();

    const intervalMs = this.getIntervalMs(timeframe);
    const interval = setInterval(fetchAndNotify, intervalMs);
    this.subscriptions.set(key, interval);

    this.logger.log(`Subscribed to ${ccxtSymbol} ${timeframe} (Bybit CCXT, interval=${intervalMs}ms)`);
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    const interval = this.subscriptions.get(key);
    if (interval) {
      clearInterval(interval);
      this.subscriptions.delete(key);
      this.logger.log(`Unsubscribed from ${key}`);
    }
  }

  async listSupportedSymbols(): Promise<string[]> {
    try {
      await this.exchange.loadMarkets();
      return Object.keys(this.exchange.markets)
        .filter((s) => s.includes('USDT'))
        .map((s) => s.replace('/', '').split(':')[0])
        .slice(0, 100);
    } catch (error: any) {
      this.logger.warn(`Bybit loadMarkets failed: ${error?.message}`);
      return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async disconnect(): Promise<void> {
    for (const [, interval] of this.subscriptions) clearInterval(interval);
    this.subscriptions.clear();
    this.connected = false;
    this.logger.log('Bybit CCXT adapter disconnected');
  }

  /**
   * Lightweight probe that does one fetchTicker() call and reports the
   * round-trip latency + error (if any). Used by the orchestrator for
   * parallel health scoring without opening a full subscription.
   */
  async probe(symbol = 'BTCUSDT'): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const ccxtSymbol = this.convertSymbol(symbol);
    const t0 = Date.now();
    try {
      await this.exchange.fetchTicker(ccxtSymbol);
      const latencyMs = Date.now() - t0;
      this.lastLatencyMs = latencyMs;
      this.lastSuccessTs = Date.now();
      this.lastError = null;
      return { ok: true, latencyMs };
    } catch (error: any) {
      const latencyMs = Date.now() - t0;
      this.lastError = error?.message || String(error);
      return { ok: false, latencyMs, error: this.lastError || undefined };
    }
  }

  private convertSymbol(moonlightSymbol: string): string {
    const mapping: Record<string, string> = {
      BTCUSDT: 'BTC/USDT',
      ETHUSDT: 'ETH/USDT',
      BNBUSDT: 'BNB/USDT',
      SOLUSDT: 'SOL/USDT',
      XRPUSDT: 'XRP/USDT',
    };
    return mapping[moonlightSymbol] || moonlightSymbol.replace(/([A-Z]{3,4})([A-Z]{3,4})/, '$1/$2');
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
