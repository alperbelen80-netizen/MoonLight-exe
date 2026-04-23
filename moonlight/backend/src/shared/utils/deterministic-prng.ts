/**
 * Deterministic PRNG utilities for replayable simulation runs.
 *
 * Uses the Mulberry32 algorithm — a tiny, fast 32-bit PRNG with solid
 * statistical properties. Given the same seed, the same sequence of
 * outputs is produced on every machine / run.
 *
 * Rationale for V2.5-2 (Broker Simulation Mode):
 *  - Backtests and broker-sim contract tests must be fully replayable.
 *  - Math.random() is non-deterministic, so any latency/slippage sampling
 *    built on it would make regressions hard to isolate.
 *  - A seed-per-run (or seed-per-session) makes every outcome reproducible.
 */
export interface SeededPrng {
  /** Returns the next float in [0, 1). */
  next(): number;
  /** Returns the next integer in [min, max] (inclusive on both ends). */
  nextInt(min: number, max: number): number;
  /** Returns the next float in [min, max). */
  nextRange(min: number, max: number): number;
  /** Returns true with probability p (0..1). */
  nextBool(p?: number): boolean;
  /** Current seed snapshot (for diagnostics + persistence). */
  getSeed(): number;
}

/**
 * Deterministic Mulberry32 PRNG.
 *
 * @example
 *   const rng = new DeterministicPrng(42);
 *   rng.next();      // 0.32…
 *   rng.nextInt(1,6); // 5
 */
export class DeterministicPrng implements SeededPrng {
  private state: number;
  private readonly originalSeed: number;

  constructor(seed: number) {
    // Normalize to a 32-bit unsigned integer. Non-finite / NaN → 0.
    const normalized = Number.isFinite(seed)
      ? Math.floor(Math.abs(seed)) >>> 0
      : 0;
    // A seed of 0 is a valid Mulberry32 seed but produces a lower-quality
    // initial output on some platforms; we nudge it so downstream callers
    // never see a degenerate first sample.
    this.state = normalized === 0 ? 0x9e3779b9 : normalized;
    this.originalSeed = normalized;
  }

  /** Derive a hashed seed from an arbitrary string (stable across runs). */
  static seedFromString(input: string): number {
    // FNV-1a 32-bit. Good enough for session / run identifiers.
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  next(): number {
    // Mulberry32 step.
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextRange(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return this.next() * (max - min) + min;
  }

  nextBool(p = 0.5): boolean {
    const prob = Math.max(0, Math.min(1, p));
    return this.next() < prob;
  }

  getSeed(): number {
    return this.originalSeed;
  }
}

/**
 * Small helper: Gaussian sample via Box–Muller. Returns a value centered at
 * `mean` with standard deviation `std`. Uses the provided PRNG so it is
 * fully deterministic.
 */
export function gaussianSample(prng: SeededPrng, mean = 0, std = 1): number {
  // u1 must be > 0 for Math.log.
  const u1 = Math.max(prng.next(), Number.EPSILON);
  const u2 = prng.next();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * std + mean;
}
