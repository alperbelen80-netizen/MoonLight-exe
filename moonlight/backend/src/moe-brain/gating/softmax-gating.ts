// MoonLight V2.0 — Softmax Gating for MoE brain aggregation.
//
// Converts a roster of ExpertOutput (+ prior expert weights) into a
// single BrainOutput. Vote mapping: APPROVE=+1, REJECT=-1, NEUTRAL=0.
// Each expert contribution is weighted by (priorWeight * confidence).
// Final score is mapped to a vote via configurable thresholds.

import { ExpertOutput, BrainOutput } from '../shared/moe.contracts';
import { BrainType, ExpertRole, ExpertVote } from '../shared/moe.enums';

export interface GatingOptions {
  approveThreshold?: number; // default +0.15
  rejectThreshold?: number; // default -0.15
  vetoTriggerRoles?: ExpertRole[]; // if any of these rejects with conf>=0.7 → vetoFlag=true
}

const DEFAULTS: Required<Pick<GatingOptions, 'approveThreshold' | 'rejectThreshold'>> = {
  approveThreshold: 0.15,
  rejectThreshold: -0.15,
};

export function softmax(values: Record<string, number>): Record<string, number> {
  const keys = Object.keys(values);
  if (keys.length === 0) return {};
  const max = Math.max(...keys.map((k) => values[k]));
  const exps = keys.map((k) => Math.exp(values[k] - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  keys.forEach((k, i) => {
    out[k] = exps[i] / sum;
  });
  return out;
}

function voteToScore(vote: ExpertVote): number {
  switch (vote) {
    case ExpertVote.APPROVE:
      return 1;
    case ExpertVote.REJECT:
      return -1;
    default:
      return 0;
  }
}

export function aggregate(
  brain: BrainType,
  experts: ExpertOutput[],
  priors: Partial<Record<ExpertRole, number>>,
  opts: GatingOptions = {},
  latencyMs = 0,
): BrainOutput {
  const approveThreshold = opts.approveThreshold ?? DEFAULTS.approveThreshold;
  const rejectThreshold = opts.rejectThreshold ?? DEFAULTS.rejectThreshold;
  const vetoTriggerRoles = opts.vetoTriggerRoles || [];

  // Use priors as logits → softmax for normalized weights.
  const logits: Record<string, number> = {};
  for (const e of experts) {
    logits[e.role] = priors[e.role] ?? 0;
  }
  const weightsNormalized = softmax(logits);

  // Weighted score (ignores experts with errors — contribute 0).
  let weightedScore = 0;
  let weightedConfidence = 0;
  let totalWeight = 0;
  let vetoFlag = false;

  for (const e of experts) {
    const w = weightsNormalized[e.role] ?? 0;
    totalWeight += w;
    if (e.error) continue;
    const clampedConf = Math.max(0, Math.min(1, e.confidence));
    weightedScore += voteToScore(e.vote) * w * clampedConf;
    weightedConfidence += w * clampedConf;

    if (
      vetoTriggerRoles.includes(e.role) &&
      e.vote === ExpertVote.REJECT &&
      clampedConf >= 0.7
    ) {
      vetoFlag = true;
    }
  }
  // Renormalize by totalWeight (should ~1 already).
  if (totalWeight > 0) {
    weightedScore /= totalWeight;
    weightedConfidence /= totalWeight;
  }

  let finalVote: ExpertVote;
  if (weightedScore >= approveThreshold) finalVote = ExpertVote.APPROVE;
  else if (weightedScore <= rejectThreshold) finalVote = ExpertVote.REJECT;
  else finalVote = ExpertVote.NEUTRAL;

  const weightsOut: Partial<Record<ExpertRole, number>> = {};
  for (const e of experts) weightsOut[e.role] = weightsNormalized[e.role] ?? 0;

  return {
    brain,
    experts,
    aggregate: {
      vote: finalVote,
      confidence: Number(Math.max(0, Math.min(1, weightedConfidence)).toFixed(3)),
      weights: weightsOut,
    },
    vetoFlag,
    latencyMs,
    timestampUtc: new Date().toISOString(),
  };
}
