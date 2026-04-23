// Deterministic fallbacks for CEO-MoE experts.
// Each function returns a single ExpertOutput based on ctx alone.
// Rules are intentionally conservative — if data is missing, return NEUTRAL low-confidence.

import { ExpertOutput } from '../shared/moe.contracts';
import { ExpertRole, ExpertVote } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';

function clamp01(x: number | undefined, fallback = 0): number {
  if (x === undefined || !Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

export function trendExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const adx = ctx.adx;
  const slope = ctx.emaSlope;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.35;

  if (adx !== undefined && adx >= 25 && slope !== undefined) {
    const alignsLong = slope > 0 && ctx.direction === 'LONG';
    const alignsShort = slope < 0 && ctx.direction === 'SHORT';
    if (alignsLong || alignsShort) {
      vote = ExpertVote.APPROVE;
      confidence = Math.min(0.9, 0.45 + (adx - 25) / 100 + Math.abs(slope) * 2);
      reasonCodes.push('ADX_STRONG', 'SLOPE_ALIGNED');
    } else {
      vote = ExpertVote.REJECT;
      confidence = 0.55;
      reasonCodes.push('ADX_STRONG_BUT_AGAINST_DIRECTION');
    }
  } else {
    reasonCodes.push('INSUFFICIENT_TREND_SIGNAL');
  }
  return {
    role: ExpertRole.TREND,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic trend fallback using ADX + EMA slope alignment.',
  };
}

export function meanReversionExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const rsi = ctx.rsi;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.3;

  if (rsi !== undefined) {
    if (rsi <= 25 && ctx.direction === 'LONG') {
      vote = ExpertVote.APPROVE;
      confidence = 0.65;
      reasonCodes.push('RSI_OVERSOLD');
    } else if (rsi >= 75 && ctx.direction === 'SHORT') {
      vote = ExpertVote.APPROVE;
      confidence = 0.65;
      reasonCodes.push('RSI_OVERBOUGHT');
    } else if ((rsi >= 70 && ctx.direction === 'LONG') || (rsi <= 30 && ctx.direction === 'SHORT')) {
      vote = ExpertVote.REJECT;
      confidence = 0.55;
      reasonCodes.push('RSI_AGAINST_DIRECTION');
    } else {
      reasonCodes.push('RSI_NEUTRAL');
    }
  } else {
    reasonCodes.push('NO_RSI');
  }
  return {
    role: ExpertRole.MEAN_REVERSION,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic mean-reversion fallback using RSI extremes.',
  };
}

export function volatilityExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const atr = ctx.atrPct;
  const bbw = ctx.bbWidthPct;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.35;

  // Fixed-time/binary logic prefers normal vol; extreme vol is dangerous.
  if (atr !== undefined) {
    if (atr > 5) {
      vote = ExpertVote.REJECT;
      confidence = 0.7;
      reasonCodes.push('ATR_TOO_HIGH');
    } else if (atr < 0.2) {
      vote = ExpertVote.REJECT;
      confidence = 0.5;
      reasonCodes.push('ATR_TOO_LOW');
    } else {
      vote = ExpertVote.APPROVE;
      confidence = 0.55;
      reasonCodes.push('ATR_NORMAL');
    }
  }
  if (bbw !== undefined && bbw > 15) {
    vote = ExpertVote.REJECT;
    confidence = Math.max(confidence, 0.65);
    reasonCodes.push('BB_WIDTH_EXTREME');
  }
  return {
    role: ExpertRole.VOLATILITY,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic volatility fallback using ATR% + BB width.',
  };
}

export function newsExpertDeterministic(ctx: MoEContext): ExpertOutput {
  // Without a real news feed, we proxy with "high-impact hour windows" (UTC).
  // NFP Friday, CPI mornings, etc. land in 12:30–15:00 UTC on average.
  const h = ctx.sessionUtcHour;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.3;
  if (h !== undefined) {
    if (h >= 12 && h <= 15) {
      vote = ExpertVote.REJECT;
      confidence = 0.55;
      reasonCodes.push('HIGH_IMPACT_NEWS_WINDOW_PROXY');
    } else {
      vote = ExpertVote.APPROVE;
      confidence = 0.4;
      reasonCodes.push('LOW_NEWS_PRESSURE_PROXY');
    }
  } else {
    reasonCodes.push('NO_SESSION_HOUR');
  }
  return {
    role: ExpertRole.NEWS,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic news-proxy fallback (time-of-day heuristic).',
  };
}

export function macroExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const h = ctx.sessionUtcHour;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.3;

  if (h !== undefined) {
    // London + NY overlap (13–16 UTC) = best liquidity
    if (h >= 13 && h <= 16) {
      vote = ExpertVote.APPROVE;
      confidence = 0.55;
      reasonCodes.push('LON_NY_OVERLAP');
    } else if (h >= 0 && h < 5) {
      vote = ExpertVote.REJECT;
      confidence = 0.45;
      reasonCodes.push('ASIA_THIN_LIQUIDITY');
    } else {
      reasonCodes.push('NORMAL_SESSION');
    }
  }
  return {
    role: ExpertRole.MACRO,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic macro fallback using trading-session liquidity window.',
  };
}

export const CEO_DETERMINISTIC_EXPERTS = {
  [ExpertRole.TREND]: trendExpertDeterministic,
  [ExpertRole.MEAN_REVERSION]: meanReversionExpertDeterministic,
  [ExpertRole.VOLATILITY]: volatilityExpertDeterministic,
  [ExpertRole.NEWS]: newsExpertDeterministic,
  [ExpertRole.MACRO]: macroExpertDeterministic,
};
