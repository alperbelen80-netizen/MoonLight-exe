// MoonLight V2.3-C — A/B weighting harness.
//
// Records EnsembleDecisions under the CURRENT orchestrator configuration
// (health-weighted ON or OFF) into an in-memory ring buffer with quick
// aggregates so UI/API can compare performance side-by-side.
//
// This keeps inference cheap: we do NOT run the orchestrator twice per
// signal. Instead we snapshot `finalWeights` + decision + brain votes and
// bucket them by `healthWeighting` mode. Users flip the env and the
// harness stores separate streams; the UI computes A/B deltas.

import { Injectable } from '@nestjs/common';
import { MoEDecision } from '../shared/moe.enums';
import { EnsembleDecision } from '../shared/moe.contracts';

export interface ABSample {
  mode: 'HEALTH_WEIGHTED' | 'STATIC';
  decision: MoEDecision;
  confidence: number;
  at: string;
  weights: { ceo: number; trade: number; test: number };
}

export interface ABBucket {
  mode: 'HEALTH_WEIGHTED' | 'STATIC';
  count: number;
  allow: number;
  skip: number;
  veto: number;
  manualReview: number;
  avgConfidence: number;
  avgWeights: { ceo: number; trade: number; test: number };
}

@Injectable()
export class ABWeightingHarnessService {
  private static readonly MAX_SAMPLES = 500;
  private samples: ABSample[] = [];

  record(decision: EnsembleDecision, healthWeighting: boolean): void {
    const s: ABSample = {
      mode: healthWeighting ? 'HEALTH_WEIGHTED' : 'STATIC',
      decision: decision.decision,
      confidence: decision.confidence,
      at: decision.timestampUtc,
      weights: {
        ceo: decision.finalWeights.ceo,
        trade: decision.finalWeights.trade,
        test: decision.finalWeights.test,
      },
    };
    this.samples.push(s);
    if (this.samples.length > ABWeightingHarnessService.MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - ABWeightingHarnessService.MAX_SAMPLES);
    }
  }

  buckets(): ABBucket[] {
    const groups: Record<string, ABSample[]> = { HEALTH_WEIGHTED: [], STATIC: [] };
    for (const s of this.samples) groups[s.mode].push(s);
    return (Object.keys(groups) as ('HEALTH_WEIGHTED' | 'STATIC')[]).map((mode) => {
      const arr = groups[mode];
      const count = arr.length;
      const allow = arr.filter((a) => a.decision === MoEDecision.ALLOW).length;
      const skip = arr.filter((a) => a.decision === MoEDecision.SKIP).length;
      const veto = arr.filter((a) => a.decision === MoEDecision.VETO).length;
      const manualReview = arr.filter(
        (a) => a.decision === MoEDecision.MANUAL_REVIEW,
      ).length;
      const avgConf =
        count === 0 ? 0 : arr.reduce((a, b) => a + b.confidence, 0) / count;
      const avgW = {
        ceo: count === 0 ? 0 : arr.reduce((a, b) => a + b.weights.ceo, 0) / count,
        trade: count === 0 ? 0 : arr.reduce((a, b) => a + b.weights.trade, 0) / count,
        test: count === 0 ? 0 : arr.reduce((a, b) => a + b.weights.test, 0) / count,
      };
      return {
        mode,
        count,
        allow,
        skip,
        veto,
        manualReview,
        avgConfidence: Number(avgConf.toFixed(3)),
        avgWeights: {
          ceo: Number(avgW.ceo.toFixed(3)),
          trade: Number(avgW.trade.toFixed(3)),
          test: Number(avgW.test.toFixed(3)),
        },
      };
    });
  }

  recent(limit = 50): ABSample[] {
    return this.samples.slice(-limit);
  }

  clear(): void {
    this.samples = [];
  }
}
