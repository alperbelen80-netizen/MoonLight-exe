import { Injectable, Logger } from '@nestjs/common';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';
import axios from 'axios';

@Injectable()
export class TradingViewWebhookAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(TradingViewWebhookAdapter.name);
  private handlers: Map<string, CandleHandler> = new Map();
  private connected = false;

  async subscribeToCandles(
    symbol: string,
    timeframe: string,
    handler: CandleHandler,
  ): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    this.handlers.set(key, handler);
    this.connected = true;

    this.logger.log(
      `TradingView webhook ready for ${key}. Configure TradingView alert to POST to /webhook/tradingview/${symbol}/${timeframe}`,
    );
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    this.handlers.delete(key);
    this.logger.log(`TradingView webhook unsubscribed from ${key}`);
  }

  handleWebhookData(symbol: string, timeframe: string, payload: any): void {
    const key = `${symbol}_${timeframe}`;
    const handler = this.handlers.get(key);

    if (!handler) {
      this.logger.warn(`No handler for ${key}`);
      return;
    }

    try {
      const candle: CandleData = {
        symbol,
        timeframe,
        timestamp: new Date(payload.time || Date.now()),
        open: parseFloat(payload.open || payload.o || 0),
        high: parseFloat(payload.high || payload.h || 0),
        low: parseFloat(payload.low || payload.l || 0),
        close: parseFloat(payload.close || payload.c || 0),
        volume: parseFloat(payload.volume || payload.v || 0),
      };

      handler(candle);

      this.logger.log(`TradingView candle processed: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error processing TradingView webhook: ${error?.message}`);
    }
  }

  async listSupportedSymbols(): Promise<string[]> {
    return ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD'];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
    this.connected = false;
    this.logger.log('TradingView webhook adapter disconnected');
  }
}
