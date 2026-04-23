// Deterministic red-team experts for TEST-MoE.
// These experts never use LLM: they must be cheap, fast, reproducible,
// and capable of blocking bad signals.

import { ExpertOutput } from '../shared/moe.contracts';
import { ExpertRole, ExpertVote } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';

function clamp01(x: number | undefined, fallback = 0): number {
  if (x === undefined || !Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

export function overfitHunter(ctx: MoEContext): ExpertOutput {
  const samples = ctx.sampleCount;
  const wr = ctx.backtestWinRate;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;

  if (samples !== undefined) {
    if (samples < 30) {
      vote = ExpertVote.REJECT;
      confidence = 0.85;
      reasonCodes.push('SAMPLE_SIZE_TOO_SMALL');
    } else if (samples >= 200 && wr !== undefined && wr <= 0.95) {
      vote = ExpertVote.APPROVE;
      confidence = 0.6;
      reasonCodes.push('SAMPLE_OK');
    } else {
      reasonCodes.push('SAMPLE_MID');
    }
  } else {
    reasonCodes.push('NO_SAMPLE_COUNT');
  }
  if (wr !== undefined && wr > 0.95) {
    vote = ExpertVote.REJECT;
    confidence = Math.max(confidence, 0.8);
    reasonCodes.push('WIN_RATE_SUSPICIOUS_HIGH');
  }
  return {
    role: ExpertRole.OVERFIT_HUNTER,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Flags too-small samples or implausibly high win rates.',
  };
}

export function dataLeakDetector(ctx: MoEContext): ExpertOutput {
  const leak = ctx.featureLeakSuspicion;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;
  if (leak !== undefined) {
    if (leak >= 0.5) {
      vote = ExpertVote.REJECT;
      confidence = 0.9;
      reasonCodes.push('FEATURE_LEAK_SUSPECTED');
    } else if (leak < 0.1) {
      vote = ExpertVote.APPROVE;
      confidence = 0.5;
      reasonCodes.push('NO_LEAK_SUSPICION');
    }
  } else {
    reasonCodes.push('NO_LEAK_FIELD');
  }
  return {
    role: ExpertRole.DATA_LEAK_DETECTOR,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Blocks signals with suspected look-ahead/data leak.',
  };
}

export function biasAuditor(ctx: MoEContext): ExpertOutput {
  // Simple bias heuristic: if win rate is extreme AND drawdown is zero, suspect curve-fit.
  const wr = ctx.backtestWinRate;
  const mdd = ctx.backtestMaxDrawdownPct;
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;
  if (wr !== undefined && mdd !== undefined) {
    if (wr > 0.8 && mdd < 1) {
      vote = ExpertVote.REJECT;
      confidence = 0.75;
      reasonCodes.push('UNREALISTIC_WR_ZERO_DD');
    } else if (wr >= 0.52 && mdd < 25) {
      vote = ExpertVote.APPROVE;
      confidence = 0.55;
      reasonCodes.push('BALANCED_PROFILE');
    }
  } else {
    reasonCodes.push('NO_WR_OR_MDD');
  }
  return {
    role: ExpertRole.BIAS_AUDITOR,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Bias audit against unrealistic WR / MDD combinations.',
  };
}

export function adversarialAttacker(ctx: MoEContext): ExpertOutput {
  // Try to break the signal: if volatility is extreme and direction is against strong trend, reject.
  const reasonCodes: string[] = [];
  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;

  const strongCounterTrend =
    ctx.adx !== undefined &&
    ctx.adx > 30 &&
    ctx.emaSlope !== undefined &&
    ((ctx.emaSlope > 0 && ctx.direction === 'SHORT') ||
      (ctx.emaSlope < 0 && ctx.direction === 'LONG'));

  const extremeVol = ctx.atrPct !== undefined && ctx.atrPct > 7;

  if (strongCounterTrend) {
    vote = ExpertVote.REJECT;
    confidence = 0.8;
    reasonCodes.push('STRONG_COUNTER_TREND');
  }
  if (extremeVol) {
    vote = ExpertVote.REJECT;
    confidence = Math.max(confidence, 0.75);
    reasonCodes.push('EXTREME_VOLATILITY');
  }
  if (reasonCodes.length === 0) {
    vote = ExpertVote.APPROVE;
    confidence = 0.4;
    reasonCodes.push('NO_ATTACK_VECTOR_FOUND');
  }
  return {
    role: ExpertRole.ADVERSARIAL_ATTACKER,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Adversarial red-team: reject on strong counter-trend or extreme vol.',
  };
}

export function robustnessTester(ctx: MoEContext): ExpertOutput {
  // Robustness: rely on payout + session + sample size consistency.
  const reasonCodes: string[] = [];
  let score = 0;
  let axes = 0;
  if (ctx.payoutPct !== undefined) {
    axes++;
    if (ctx.payoutPct >= 80) score++;
  }
  if (ctx.sampleCount !== undefined) {
    axes++;
    if (ctx.sampleCount >= 100) score++;
  }
  if (ctx.sessionUtcHour !== undefined) {
    axes++;
    const inActive = ctx.sessionUtcHour >= 7 && ctx.sessionUtcHour <= 20;
    if (inActive) score++;
  }
  if (ctx.atrPct !== undefined) {
    axes++;
    if (ctx.atrPct >= 0.3 && ctx.atrPct <= 5) score++;
  }

  let vote: ExpertVote = ExpertVote.NEUTRAL;
  let confidence = 0.4;
  if (axes === 0) {
    reasonCodes.push('INSUFFICIENT_CONTEXT');
  } else {
    const ratio = score / axes;
    if (ratio >= 0.75) {
      vote = ExpertVote.APPROVE;
      confidence = 0.7;
      reasonCodes.push(`ROBUST_${score}/${axes}`);
    } else if (ratio <= 0.25) {
      vote = ExpertVote.REJECT;
      confidence = 0.7;
      reasonCodes.push(`FRAGILE_${score}/${axes}`);
    } else {
      reasonCodes.push(`MIXED_${score}/${axes}`);
    }
  }
  return {
    role: ExpertRole.ROBUSTNESS_TESTER,
    vote,
    confidence: clamp01(confidence, 0.3),
    reasonCodes,
    rationale: 'Robustness ratio across payout/sample/session/vol axes.',
  };
}

export const TEST_DETERMINISTIC_EXPERTS = {
  [ExpertRole.OVERFIT_HUNTER]: overfitHunter,
  [ExpertRole.DATA_LEAK_DETECTOR]: dataLeakDetector,
  [ExpertRole.BIAS_AUDITOR]: biasAuditor,
  [ExpertRole.ADVERSARIAL_ATTACKER]: adversarialAttacker,
  [ExpertRole.ROBUSTNESS_TESTER]: robustnessTester,
};
