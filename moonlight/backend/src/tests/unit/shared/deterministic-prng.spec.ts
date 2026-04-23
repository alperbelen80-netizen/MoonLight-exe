import { DeterministicPrng, gaussianSample } from '../../../shared/utils/deterministic-prng';

describe('DeterministicPrng (V2.5-2)', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new DeterministicPrng(42);
    const b = new DeterministicPrng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new DeterministicPrng(42);
    const b = new DeterministicPrng(43);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() outputs are within [0, 1)', () => {
    const rng = new DeterministicPrng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt respects inclusive bounds', () => {
    const rng = new DeterministicPrng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextBool(1) is always true and nextBool(0) is always false', () => {
    const rng = new DeterministicPrng(11);
    for (let i = 0; i < 50; i++) {
      expect(rng.nextBool(1)).toBe(true);
      expect(rng.nextBool(0)).toBe(false);
    }
  });

  it('seedFromString is stable across runs', () => {
    const a = DeterministicPrng.seedFromString('moonlight::IQ_OPTION::v2.5-2');
    const b = DeterministicPrng.seedFromString('moonlight::IQ_OPTION::v2.5-2');
    const c = DeterministicPrng.seedFromString('moonlight::OLYMP_TRADE::v2.5-2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('handles non-finite / negative seeds gracefully', () => {
    expect(() => new DeterministicPrng(NaN).next()).not.toThrow();
    expect(() => new DeterministicPrng(-5).next()).not.toThrow();
    expect(() => new DeterministicPrng(Infinity).next()).not.toThrow();
  });

  it('gaussianSample stays well-centered given enough draws', () => {
    const rng = new DeterministicPrng(12345);
    const n = 5000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += gaussianSample(rng, 100, 10);
    }
    const mean = sum / n;
    // With n=5000 and std=10, mean should be well within ±1 of 100.
    expect(Math.abs(mean - 100)).toBeLessThan(1.5);
  });
});
