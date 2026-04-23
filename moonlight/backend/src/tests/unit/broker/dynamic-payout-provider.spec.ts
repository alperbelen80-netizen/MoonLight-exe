import { DynamicPayoutProvider } from '../../../broker/payout/dynamic-payout-provider.service';

/**
 * V2.6-5-C DynamicPayoutProvider unit tests.
 *
 * Validates the IQ Option adapter → payout matrix integration without
 * actually connecting to the broker (we stub snapshotPayouts).
 */
describe('DynamicPayoutProvider (v2.6-5-C)', () => {
  it('returns null when no adapter wired', async () => {
    const p = new DynamicPayoutProvider(undefined);
    const res = await p.getPayoutForSlot('EURUSD', 5);
    expect(res).toBeNull();
  });

  it('returns BROKER_API payout when adapter has cached value', async () => {
    const fake = {
      snapshotPayouts: () => ({ 'EURUSD:5': 0.87, 'BTCUSD:15': 0.83 }),
    };
    const p = new DynamicPayoutProvider(fake as never);
    const res = await p.getPayoutForSlot('EURUSD', 5);
    expect(res).not.toBeNull();
    expect(res?.source).toBe('BROKER_API');
    expect(res?.payout_ratio).toBeCloseTo(0.87);
  });

  it('returns null when key not in cache (caller falls back to STATIC)', async () => {
    const fake = { snapshotPayouts: () => ({}) };
    const p = new DynamicPayoutProvider(fake as never);
    expect(await p.getPayoutForSlot('GBPUSD', 15)).toBeNull();
  });

  it('snapshot() returns array form for Owner Console', () => {
    const fake = {
      snapshotPayouts: () => ({ 'EURUSD:5': 0.87, 'BAD': 0.5 }),
    };
    const p = new DynamicPayoutProvider(fake as never);
    const snap = p.snapshot();
    expect(snap.length).toBe(1); // bad key filtered
    expect(snap[0]).toEqual({ symbol: 'EURUSD', expiryMinutes: 5, ratio: 0.87 });
  });

  it('refreshPayoutMatrix touches lastUpdate', async () => {
    const fake = { snapshotPayouts: () => ({ 'EURUSD:5': 0.87 }) };
    const p = new DynamicPayoutProvider(fake as never);
    expect(p.getLastUpdateTime()).toBeNull();
    await p.refreshPayoutMatrix();
    expect(p.getLastUpdateTime()).not.toBeNull();
  });
});
