// Deterministic fallbacks for TRADE-MoE experts.

import { ExpertOutput } from '../shared/moe.contracts';
import { ExpertRole, ExpertVote } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';

function clamp01(x: number | undefined, fallback = 0): number {
  if (x === undefined || !Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

export function entryExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;

  const conf = ctx.confidenceScore ?? 0;
  if (conf >= 0.7) {
    vote = ExpertVote.APPROVE;
    confidence = Math.min(0.9, conf);
    reasonCodes.push('UPSTREAM_CONF_STRONG');
  } else if (conf < 0.4) {
    vote = ExpertVote.REJECT;
    confidence = 0.6;
    reasonCodes.push('UPSTREAM_CONF_WEAK');
  } else {
    reasonCodes.push('UPSTREAM_CONF_MID');
  }
  return {
    role: ExpertRole.ENTRY,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic entry-timing fallback via upstream confidence.',
  };
}

export function exitExpertDeterministic(ctx: MoEContext): ExpertOutput {
  // Fixed-time/binary: exit is determined by TF expiry — mainly ensure TF is sane.
  const reasonCodes: string[] = [];
  const tfGood = !!ctx.timeframe && /^(5m|15m|30m|1h|2h|4h|8h|1m|3m|1d)$/i.test(ctx.timeframe);
  return {
    role: ExpertRole.EXIT,
    vote: tfGood ? ExpertVote.APPROVE : ExpertVote.REJECT,
    confidence: tfGood ? 0.55 : 0.75,
    reasonCodes: tfGood ? ['TF_VALID'] : ['TF_INVALID'],
    rationale: 'Deterministic exit fallback: fixed-time expiry requires known TF.',
  };
}

export function slippageExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const bps = ctx.expectedSlippageBps;
  const spread = ctx.spreadBps;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;

  const worst = Math.max(bps ?? 0, spread ?? 0);
  if (worst > 0) {
    if (worst > 15) {
      vote = ExpertVote.REJECT;
      confidence = 0.75;
      reasonCodes.push('SLIPPAGE_OR_SPREAD_HIGH');
    } else if (worst < 5) {
      vote = ExpertVote.APPROVE;
      confidence = 0.6;
      reasonCodes.push('SLIPPAGE_LOW');
    } else {
      reasonCodes.push('SLIPPAGE_MID');
    }
  } else {
    reasonCodes.push('NO_SLIPPAGE_DATA');
  }
  return {
    role: ExpertRole.SLIPPAGE,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic slippage/spread fallback.',
  };
}

export function payoutExpertDeterministic(ctx: MoEContext): ExpertOutput {
  // Binary/fixed-time: payout is critical — below 70% we reject.
  const p = ctx.payoutPct;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;

  if (p !== undefined) {
    if (p >= 85) {
      vote = ExpertVote.APPROVE;
      confidence = 0.8;
      reasonCodes.push('PAYOUT_EXCELLENT');
    } else if (p >= 75) {
      vote = ExpertVote.APPROVE;
      confidence = 0.6;
      reasonCodes.push('PAYOUT_OK');
    } else if (p < 70) {
      vote = ExpertVote.REJECT;
      confidence = 0.85;
      reasonCodes.push('PAYOUT_LOW');
    } else {
      reasonCodes.push('PAYOUT_MID');
    }
  } else {
    reasonCodes.push('NO_PAYOUT');
  }
  return {
    role: ExpertRole.PAYOUT,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic payout threshold fallback (binary options aware).',
  };
}

export function sessionExpertDeterministic(ctx: MoEContext): ExpertOutput {
  const h = ctx.sessionUtcHour;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.35;

  if (h !== undefined) {
    if (h >= 7 && h <= 17) {
      vote = ExpertVote.APPROVE;
      confidence = 0.6;
      reasonCodes.push('EU_US_ACTIVE_HOURS');
    } else if (h >= 22 || h < 2) {
      vote = ExpertVote.REJECT;
      confidence = 0.5;
      reasonCodes.push('LOW_LIQUIDITY_HOURS');
    } else {
      reasonCodes.push('NORMAL_HOURS');
    }
  }
  return {
    role: ExpertRole.SESSION,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Deterministic session fallback.',
  };
}

export const TRADE_DETERMINISTIC_EXPERTS = {
  [ExpertRole.ENTRY]: entryExpertDeterministic,
  [ExpertRole.EXIT]: exitExpertDeterministic,
  [ExpertRole.SLIPPAGE]: slippageExpertDeterministic,
  [ExpertRole.PAYOUT]: payoutExpertDeterministic,
  [ExpertRole.SESSION]: sessionExpertDeterministic,
};
