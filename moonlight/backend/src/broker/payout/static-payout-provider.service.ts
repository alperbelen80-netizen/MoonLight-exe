import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider, PayoutData, PayoutMatrix } from './payout-provider.interface';

@Injectable()
export class StaticPayoutProvider implements IPayoutProvider {
  private readonly logger = new Logger(StaticPayoutProvider.name);
  private payoutMatrix: PayoutMatrix = {};
  private lastUpdate: Date | null = null;

  private readonly DEFAULT_PAYOUTS: Record<number, number> = {
    1: 0.82,
    5: 0.85,
    15: 0.87,
    30: 0.88,
    60: 0.89,
    240: 0.90,
  };

  constructor() {
    this.initializeStaticMatrix();
  }

  private initializeStaticMatrix(): void {
    const symbols = ['XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'ETHUSD'];

    for (const symbol of symbols) {
      this.payoutMatrix[symbol] = {};

      for (const [expiry, ratio] of Object.entries(this.DEFAULT_PAYOUTS)) {
        this.payoutMatrix[symbol][parseInt(expiry)] = {
          symbol,
          expiry_minutes: parseInt(expiry),
          payout_ratio: ratio,
          timestamp: new Date(),
          source: 'STATIC',
        };
      }
    }

    this.lastUpdate = new Date();
    this.logger.log('Static payout matrix initialized');
  }

  async getPayoutForSlot(
    symbol: string,
    expiryMinutes: number,
  ): Promise<PayoutData | null> {
    const symbolMatrix = this.payoutMatrix[symbol];

    if (!symbolMatrix) {
      return null;
    }

    return symbolMatrix[expiryMinutes] || null;
  }

  async refreshPayoutMatrix(): Promise<void> {
    this.logger.log('Static payout matrix refresh (no-op)');
  }

  getLastUpdateTime(): Date | null {
    return this.lastUpdate;
  }
}
