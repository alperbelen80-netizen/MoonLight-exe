import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';
import { Timeframe } from '../../shared/enums/timeframe.enum';

@Injectable()
export class BinanceCCXTAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(BinanceCCXTAdapter.name);
  private exchange: ccxt.binance;
  private subscriptions: Map<string, NodeJS.Timeout> = new Map();
  private connected = false;

  constructor() {
    this.exchange = new ccxt.binance({
      enableRateLimit: true,
      options: {
        defaultType: 'future',
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

    this.connected = true;

    const ccxtSymbol = this.convertSymbol(symbol);
    const ccxtTimeframe = this.convertTimeframe(timeframe);

    const fetchAndNotify = async () => {
      try {
        const ohlcv = await this.exchange.fetchOHLCV(
          ccxtSymbol,
          ccxtTimeframe,
          undefined,
          1,
        );

        if (ohlcv && ohlcv.length > 0) {
          const [timestamp, open, high, low, close, volume] = ohlcv[0];

          const candle: CandleData = {
            symbol,
            timeframe,
            timestamp: new Date(timestamp),
            open,
            high,
            low,
            close,
            volume,
          };

          handler(candle);
        }
      } catch (error: any) {
        this.logger.error(
          `Error fetching candle for ${key}: ${error?.message || String(error)}`,
        );
      }
    };

    await fetchAndNotify();

    const intervalMs = this.getIntervalMs(timeframe);
    const interval = setInterval(fetchAndNotify, intervalMs);

    this.subscriptions.set(key, interval);

    this.logger.log(
      `Subscribed to ${ccxtSymbol} ${ccxtTimeframe} (Binance CCXT, interval: ${intervalMs}ms)`,
    );
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
      const symbols = Object.keys(this.exchange.markets);

      return symbols
        .filter((s) => s.includes('USDT'))
        .map((s) => s.replace('/', ''));
    } catch (error: any) {
      this.logger.error(`Error loading markets: ${error?.message}`);
      return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    for (const [key, interval] of this.subscriptions) {
      clearInterval(interval);
    }
    this.subscriptions.clear();
    this.connected = false;
    this.logger.log('Binance CCXT adapter disconnected');
  }

  private convertSymbol(moonlightSymbol: string): string {
    const mapping: Record<string, string> = {
      BTCUSDT: 'BTC/USDT',
      ETHUSDT: 'ETH/USDT',
      BNBUSDT: 'BNB/USDT',
      XAUUSD: 'XAU/USD',
      EURUSD: 'EUR/USD',
    };

    return mapping[moonlightSymbol] || moonlightSymbol.replace(/([A-Z]{3,4})([A-Z]{3,4})/, '$1/$2');
  }

  private convertTimeframe(moonlightTf: string): string {
    return moonlightTf;
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
