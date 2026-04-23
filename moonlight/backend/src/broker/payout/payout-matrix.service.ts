import { Injectable, Logger, Optional } from '@nestjs/common';
import { IPayoutProvider, PayoutData } from './payout-provider.interface';
import { StaticPayoutProvider } from './static-payout-provider.service';
import { BrokerAPIPayoutProvider } from './broker-api-payout-provider.service';
import { DynamicPayoutProvider } from './dynamic-payout-provider.service';

export type PayoutProviderType = 'STATIC' | 'BROKER_API' | 'UI_SCRAPE' | 'DYNAMIC';

@Injectable()
export class PayoutMatrixService {
  private readonly logger = new Logger(PayoutMatrixService.name);
  private providers: Map<PayoutProviderType, IPayoutProvider> = new Map();
  private activeProvider: PayoutProviderType;

  constructor(
    @Optional() private readonly dynamic?: DynamicPayoutProvider,
  ) {
    this.providers.set('STATIC', new StaticPayoutProvider());
    this.providers.set('BROKER_API', new BrokerAPIPayoutProvider());
    if (this.dynamic) {
      this.providers.set('DYNAMIC', this.dynamic);
    }

    const requested = (process.env.PAYOUT_PROVIDER as PayoutProviderType) || 'STATIC';
    // v2.6-5-C: if DYNAMIC requested but adapter not wired, transparently
    // fall back to STATIC so the system never deadlocks on missing DI.
    if (requested === 'DYNAMIC' && !this.providers.has('DYNAMIC')) {
      this.logger.warn(
        'PAYOUT_PROVIDER=DYNAMIC requested but DynamicPayoutProvider not wired → falling back to STATIC',
      );
      this.activeProvider = 'STATIC';
    } else {
      this.activeProvider = requested;
    }

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

    // v2.6-5-C: DYNAMIC provider often misses specific slots (WSS stream
    // may not have delivered yet). Fall back to STATIC silently so the
    // caller never gets null — routing/EV always has a number to work with.
    if (this.activeProvider !== 'STATIC') {
      const staticProv = this.providers.get('STATIC');
      if (staticProv) {
        const staticPayout = await staticProv.getPayoutForSlot(symbol, expiryMinutes);
        if (staticPayout) return { ...staticPayout, source: 'CACHED' };
      }
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

  /** v2.6-5-C: lets the Owner Console flip provider at runtime (no restart). */
  setActiveProvider(next: PayoutProviderType): void {
    if (!this.providers.has(next)) {
      throw new Error(`provider ${next} is not registered`);
    }
    this.activeProvider = next;
    this.logger.log(`active payout provider switched to ${next}`);
  }

  listProviders(): PayoutProviderType[] {
    return Array.from(this.providers.keys());
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
