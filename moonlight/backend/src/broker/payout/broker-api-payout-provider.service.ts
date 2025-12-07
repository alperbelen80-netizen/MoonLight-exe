import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider, PayoutData } from './payout-provider.interface';
import axios from 'axios';

@Injectable()
export class BrokerAPIPayoutProvider implements IPayoutProvider {
  private readonly logger = new Logger(BrokerAPIPayoutProvider.name);
  private cache: Map<string, PayoutData> = new Map();
  private lastUpdate: Date | null = null;
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.BROKER_PAYOUT_API_URL || '';
    this.apiKey = process.env.BROKER_PAYOUT_API_KEY || '';
  }

  async getPayoutForSlot(
    symbol: string,
    expiryMinutes: number,
  ): Promise<PayoutData | null> {
    const cacheKey = `${symbol}_${expiryMinutes}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < 60000) {
        return cached;
      }
    }

    try {
      const response = await axios.get(`${this.apiUrl}/payout`, {
        params: { symbol, expiry: expiryMinutes },
        headers: { 'X-API-Key': this.apiKey },
        timeout: 5000,
      });

      if (response.data && response.data.payout) {
        const payoutData: PayoutData = {
          symbol,
          expiry_minutes: expiryMinutes,
          payout_ratio: response.data.payout,
          timestamp: new Date(),
          source: 'BROKER_API',
        };

        this.cache.set(cacheKey, payoutData);
        return payoutData;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch payout from API: ${error?.message}`,
      );
    }

    return null;
  }

  async refreshPayoutMatrix(): Promise<void> {
    this.logger.log('Refreshing payout matrix from broker API');

    const symbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD'];
    const expiries = [1, 5, 15, 30, 60];

    for (const symbol of symbols) {
      for (const expiry of expiries) {
        await this.getPayoutForSlot(symbol, expiry);
      }
    }

    this.lastUpdate = new Date();
  }

  getLastUpdateTime(): Date | null {
    return this.lastUpdate;
  }
}
