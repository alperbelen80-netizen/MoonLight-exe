import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { IPayoutProvider, PayoutData } from './payout-provider.interface';
import { IQOptionRealAdapter } from '../adapters/iq-option-real.adapter';

/**
 * V2.6-5-C Dynamic Payout Provider.
 *
 * Reads payout ratios from **live broker adapters** (currently IQ Option
 * via its `instruments.binary.payout` WSS subscription). If the adapter
 * has a cached value for the requested (symbol, expiry_minutes) slot we
 * return it tagged as `BROKER_API`. Otherwise we return null so the
 * caller (`PayoutMatrixService`) can fall back to the static matrix.
 *
 * Why a separate provider instead of `BrokerAPIPayoutProvider`?
 *   - Clean separation: the existing `BrokerAPIPayoutProvider` is a
 *     placeholder for a future *pull-based* API; our dynamic provider
 *     is driven by the already-subscribed WSS payout stream (which is
 *     what real deployments will use).
 *   - Optional dependency: if the IQOptionRealAdapter isn't wired into
 *     the DI graph (or not enabled), the provider degrades to null
 *     without throwing, keeping the rest of the payout pipeline green.
 */
@Injectable()
export class DynamicPayoutProvider implements IPayoutProvider {
  private readonly logger = new Logger(DynamicPayoutProvider.name);
  private lastUpdate: Date | null = null;

  constructor(
    @Optional()
    @Inject(IQOptionRealAdapter)
    private readonly iqAdapter?: IQOptionRealAdapter,
  ) {
    this.logger.log(
      `DynamicPayoutProvider initialized (iqAdapter=${this.iqAdapter ? 'wired' : 'absent'})`,
    );
  }

  async getPayoutForSlot(
    symbol: string,
    expiryMinutes: number,
  ): Promise<PayoutData | null> {
    if (!this.iqAdapter) return null;
    const snap = this.iqAdapter.snapshotPayouts();
    const key = `${symbol}:${expiryMinutes}`;
    const value = snap[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    this.lastUpdate = new Date();
    return {
      symbol,
      expiry_minutes: expiryMinutes,
      payout_ratio: value,
      timestamp: this.lastUpdate,
      source: 'BROKER_API',
    };
  }

  async refreshPayoutMatrix(): Promise<void> {
    // No-op — the adapter populates the cache in real time via WSS
    // subscription. This method exists only to satisfy IPayoutProvider.
    if (this.iqAdapter) {
      // Touch snapshot so the logger has fresh timing.
      const snap = this.iqAdapter.snapshotPayouts();
      this.logger.debug(
        `DynamicPayout snapshot size=${Object.keys(snap).length}`,
      );
      this.lastUpdate = new Date();
    }
  }

  getLastUpdateTime(): Date | null {
    return this.lastUpdate;
  }

  /**
   * Return the current full snapshot (for /api/broker/payout endpoint).
   * Each entry is `{ key: "<symbol>:<expiryMinutes>", ratio }`.
   */
  snapshot(): Array<{ symbol: string; expiryMinutes: number; ratio: number }> {
    if (!this.iqAdapter) return [];
    const snap = this.iqAdapter.snapshotPayouts();
    const out: Array<{ symbol: string; expiryMinutes: number; ratio: number }> = [];
    for (const [key, ratio] of Object.entries(snap)) {
      const [symbol, expStr] = key.split(':');
      const expiryMinutes = Number(expStr);
      if (!symbol || !Number.isFinite(expiryMinutes)) continue;
      out.push({ symbol, expiryMinutes, ratio });
    }
    return out;
  }
}
