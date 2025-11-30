import { Injectable, Logger } from '@nestjs/common';
import { IDataFeedAdapter, CandleData, CandleHandler } from './data-feed.interface';
import axios from 'axios';
import * as WebSocket from 'ws';

@Injectable()
export class IQOptionAPIAdapter implements IDataFeedAdapter {
  private readonly logger = new Logger(IQOptionAPIAdapter.name);
  private ws?: WebSocket;
  private handlers: Map<string, CandleHandler> = new Map();
  private connected = false;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.IQ_OPTION_API_KEY || '';
    this.apiSecret = process.env.IQ_OPTION_API_SECRET || '';
  }

  async subscribeToCandles(
    symbol: string,
    timeframe: string,
    handler: CandleHandler,
  ): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    this.handlers.set(key, handler);

    if (!this.connected) {
      await this.connect();
    }

    this.sendSubscribeMessage(symbol, timeframe);

    this.logger.log(`IQ Option subscribed to ${key}`);
  }

  async unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void> {
    const key = `${symbol}_${timeframe}`;
    this.handlers.delete(key);

    this.sendUnsubscribeMessage(symbol, timeframe);

    this.logger.log(`IQ Option unsubscribed from ${key}`);
  }

  async listSupportedSymbols(): Promise<string[]> {
    return ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD'];
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.handlers.clear();
    this.connected = false;
    this.logger.log('IQ Option adapter disconnected');
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket';

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.logger.log('IQ Option WebSocket connected');
        this.connected = true;

        if (this.apiKey && this.apiSecret) {
          this.sendAuthMessage();
        }

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error(`IQ Option WebSocket error: ${error.message}`);
        reject(error);
      });

      this.ws.on('close', () => {
        this.logger.warn('IQ Option WebSocket closed. Reconnecting...');
        this.connected = false;
        setTimeout(() => this.connect(), 5000);
      });
    });
  }

  private sendAuthMessage(): void {
    if (!this.ws) return;

    const authMsg = {
      name: 'ssid',
      msg: {
        ssid: this.apiKey,
      },
    };

    this.ws.send(JSON.stringify(authMsg));
    this.logger.log('IQ Option auth message sent');
  }

  private sendSubscribeMessage(symbol: string, timeframe: string): void {
    if (!this.ws) return;

    const subscribeMsg = {
      name: 'subscribeMessage',
      msg: {
        name: 'candles-generated',
        params: {
          routingFilters: {
            active_id: this.getActiveId(symbol),
            size: this.getSize(timeframe),
          },
        },
      },
    };

    this.ws.send(JSON.stringify(subscribeMsg));
  }

  private sendUnsubscribeMessage(symbol: string, timeframe: string): void {
    if (!this.ws) return;

    const unsubscribeMsg = {
      name: 'unsubscribeMessage',
      msg: {
        name: 'candles-generated',
        params: {
          routingFilters: {
            active_id: this.getActiveId(symbol),
            size: this.getSize(timeframe),
          },
        },
      },
    };

    this.ws.send(JSON.stringify(unsubscribeMsg));
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.name === 'candles') {
        const candleData = message.msg;

        const symbol = this.getSymbolFromActiveId(candleData.active_id);
        const timeframe = this.getTimeframeFromSize(candleData.size);
        const key = `${symbol}_${timeframe}`;

        const handler = this.handlers.get(key);
        if (handler) {
          const candle: CandleData = {
            symbol,
            timeframe,
            timestamp: new Date(candleData.from * 1000),
            open: candleData.open,
            high: candleData.max,
            low: candleData.min,
            close: candleData.close,
            volume: candleData.volume || 0,
          };

          handler(candle);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error handling IQ Option message: ${error?.message}`);
    }
  }

  private getActiveId(symbol: string): number {
    const mapping: Record<string, number> = {
      EURUSD: 1,
      GBPUSD: 2,
      USDJPY: 3,
      XAUUSD: 81,
    };
    return mapping[symbol] || 1;
  }

  private getSymbolFromActiveId(activeId: number): string {
    const mapping: Record<number, string> = {
      1: 'EURUSD',
      2: 'GBPUSD',
      3: 'USDJPY',
      81: 'XAUUSD',
    };
    return mapping[activeId] || 'UNKNOWN';
  }

  private getSize(timeframe: string): number {
    const mapping: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
    };
    return mapping[timeframe] || 60;
  }

  private getTimeframeFromSize(size: number): string {
    const mapping: Record<number, string> = {
      60: '1m',
      300: '5m',
      900: '15m',
      3600: '1h',
    };
    return mapping[size] || '1m';
  }
}
