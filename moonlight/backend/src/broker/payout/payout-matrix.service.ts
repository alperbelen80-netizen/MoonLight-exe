import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider, PayoutData } from './payout-provider.interface';
import { StaticPayoutProvider } from './static-payout-provider.service';
import { BrokerAPIPayoutProvider } from './broker-api-payout-provider.service';

export type PayoutProviderType = 'STATIC' | 'BROKER_API' | 'UI_SCRAPE';

@Injectable()
export class PayoutMatrixService {
  private readonly logger = new Logger(PayoutMatrixService.name);
  private providers: Map<PayoutProviderType, IPayoutProvider> = new Map();
  private activeProvider: PayoutProviderType;

  constructor() {
    this.providers.set('STATIC', new StaticPayoutProvider());
    this.providers.set('BROKER_API', new BrokerAPIPayoutProvider());

    this.activeProvider =
      (process.env.PAYOUT_PROVIDER as PayoutProviderType) || 'STATIC';

    this.logger.log(`PayoutMatrixService initialized with provider: ${this.activeProvider}`);
  }

  async getPayoutForSlot(
    symbol: string,
    expiryMinutes: number,
  ): Promise<PayoutData> {
    const provider = this.providers.get(this.activeProvider);

    if (!provider) {
      this.logger.error(`Provider ${this.activeProvider} not found, falling back to STATIC`);
      const fallback = this.providers.get('STATIC')!;
      return (await fallback.getPayoutForSlot(symbol, expiryMinutes)) || this.getDefaultPayout(symbol, expiryMinutes);
    }

    const payout = await provider.getPayoutForSlot(symbol, expiryMinutes);

    if (payout) {
      return payout;
    }

    this.logger.warn(
      `No payout found for ${symbol} ${expiryMinutes}m, using default`,
    );
    return this.getDefaultPayout(symbol, expiryMinutes);
  }

  async refreshMatrix(): Promise<void> {
    const provider = this.providers.get(this.activeProvider);
    if (provider) {
      await provider.refreshPayoutMatrix();
      this.logger.log('Payout matrix refreshed');
    }
  }

  getActiveProvider(): PayoutProviderType {
    return this.activeProvider;
  }

  private getDefaultPayout(symbol: string, expiryMinutes: number): PayoutData {
    const defaultRatio = expiryMinutes <= 5 ? 0.82 : expiryMinutes <= 30 ? 0.85 : 0.88;

    return {
      symbol,
      expiry_minutes: expiryMinutes,
      payout_ratio: defaultRatio,
      timestamp: new Date(),
      source: 'STATIC',
    };
  }
}
