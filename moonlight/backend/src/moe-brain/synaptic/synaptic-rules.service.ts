// MoonLight V2.0-ε — Synaptic Rules Service.
//
// Implements the 6 biologically-inspired synaptic update rules specified
// in the V2.0 brief: RESIDUAL, HEBBIAN, ANTI_HEBBIAN, HOMEOSTATIC,
// PLASTIC, SPIKE.  Every rule returns a CLAMPED weight delta that is
// guard-railed by `maxStep`, `decay`, and hard clamp to [0, 1] so the
// system cannot explode or collapse to zero. Used by the Topology
// Governor (GÖZ-3) to evolve expert priors over time based on feedback
// from Decision Auditor (GÖZ-2).

import { Injectable, Logger } from '@nestjs/common';
import { SynapticRule } from '../shared/moe.enums';

export interface SynapticUpdate {
  rule: SynapticRule;
  before: number;
  after: number;
  delta: number;
  clamped: boolean;
  reason?: string;
}

export interface SynapticConfig {
  learningRate: number; // default 0.05
  decay: number; // per-step weight decay, default 0.001
  maxStep: number; // maximum |delta| per step, default 0.1
  targetRate: number; // homeostatic target, default 0.5
  spikeThreshold: number; // abs(x) threshold for SPIKE, default 0.7
  minWeight: number; // hard clamp floor, default 0.02 (prevent dead neurons)
  maxWeight: number; // hard clamp ceiling, default 0.98
}

const DEFAULT_CONFIG: SynapticConfig = {
  learningRate: 0.05,
  decay: 0.001,
  maxStep: 0.1,
  targetRate: 0.5,
  spikeThreshold: 0.7,
  minWeight: 0.02,
  maxWeight: 0.98,
};

@Injectable()
export class SynapticRulesService {
  private readonly logger = new Logger(SynapticRulesService.name);
  private config: SynapticConfig = { ...DEFAULT_CONFIG };

  getConfig(): SynapticConfig {
    return { ...this.config };
  }

  setConfig(patch: Partial<SynapticConfig>): SynapticConfig {
    this.config = { ...this.config, ...patch };
    return this.getConfig();
  }

  /**
   * Apply a given rule. Returns both new weight and diagnostic info.
   * Inputs x,y are in range [-1..+1] (or [0..1] depending on context).
   */
  apply(
    rule: SynapticRule,
    weight: number,
    x: number,
    y: number,
    actualRate?: number,
  ): SynapticUpdate {
    const cfg = this.config;
    let rawDelta = 0;
    switch (rule) {
      case SynapticRule.RESIDUAL:
        // Residual: y = f(x) + x — preserves identity; for weight dynamics we
        // add a small identity-preserving pull toward 1.0 scaled by x.
        rawDelta = cfg.learningRate * 0.1 * (x - weight);
        break;
      case SynapticRule.HEBBIAN:
        // Δw = η·x·y
        rawDelta = cfg.learningRate * x * y;
        break;
      case SynapticRule.ANTI_HEBBIAN:
        // Δw = -η·x·y
        rawDelta = -cfg.learningRate * x * y;
        break;
      case SynapticRule.HOMEOSTATIC: {
        // w ← w · (target / actual); here compute delta.
        const ar = actualRate === undefined || actualRate <= 0 ? cfg.targetRate : actualRate;
        const factor = cfg.targetRate / ar;
        rawDelta = weight * (factor - 1);
        break;
      }
      case SynapticRule.PLASTIC: {
        // Dynamic LR: scale learning rate by novelty = |x - y|.
        const novelty = Math.min(1, Math.abs(x - y));
        rawDelta = cfg.learningRate * (1 + novelty) * x * y;
        break;
      }
      case SynapticRule.SPIKE: {
        // Threshold activation: only fire when |x| >= spikeThreshold.
        if (Math.abs(x) < cfg.spikeThreshold) {
          rawDelta = 0;
        } else {
          rawDelta = cfg.learningRate * Math.sign(x) * y;
        }
        break;
      }
      default:
        rawDelta = 0;
    }

    // 1) cap delta magnitude (maxStep)
    const cappedDelta = Math.max(-cfg.maxStep, Math.min(cfg.maxStep, rawDelta));

    // 2) decay-applied weight
    const decayed = weight * (1 - cfg.decay);

    // 3) apply cap delta
    const raw = decayed + cappedDelta;

    // 4) hard clamp to [minWeight, maxWeight]
    const after = Math.max(cfg.minWeight, Math.min(cfg.maxWeight, raw));

    const clamped =
      after !== raw ||
      cappedDelta !== rawDelta ||
      (!Number.isFinite(rawDelta) ? true : false);

    return {
      rule,
      before: weight,
      after: Number(after.toFixed(6)),
      delta: Number((after - weight).toFixed(6)),
      clamped,
      reason: clamped ? 'guardrail_applied' : undefined,
    };
  }

  /**
   * Batch apply: iterates rules sequentially over a weight-map.
   * Useful for testing rule compositions.
   */
  applyBatch(
    rule: SynapticRule,
    weights: Record<string, number>,
    signals: Record<string, { x: number; y: number; actualRate?: number }>,
  ): Record<string, SynapticUpdate> {
    const out: Record<string, SynapticUpdate> = {};
    for (const key of Object.keys(weights)) {
      const sig = signals[key];
      if (!sig) continue;
      out[key] = this.apply(rule, weights[key], sig.x, sig.y, sig.actualRate);
    }
    return out;
  }
}
