// MoonLight V2.0 — MoE Signal context input (extends SignalInput with market stats).
// Used by experts to reason. All optional except symbol/timeframe/direction
// so deterministic fallbacks can still work on partial data.

import { SignalInput } from './moe.contracts';

export interface MoEContext extends SignalInput {
  // Trend + momentum features
  adx?: number; // 0..100
  rsi?: number; // 0..100
  emaSlope?: number; // +/- percentage
  macdHist?: number;

  // Volatility + price structure
  atrPct?: number; // ATR / price in %
  bbWidthPct?: number;
  priceVsVwapPct?: number;

  // Execution context
  payoutPct?: number; // broker payout 0..100
  spreadBps?: number;
  expectedSlippageBps?: number;
  sessionUtcHour?: number; // 0..23

  // Upstream quality
  strategy?: string;
  sampleCount?: number; // how many backtest samples support the preset
  backtestWinRate?: number; // 0..1
  backtestMaxDrawdownPct?: number;
  featureLeakSuspicion?: number; // 0..1 from upstream validator

  // Regime label (may be produced by regime detector)
  regime?: 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'VOLATILE' | 'QUIET' | string;
}
