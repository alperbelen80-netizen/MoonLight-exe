// MoonLight V2.0-γ — Global MoE Orchestrator.
//
// Calls CEO + TRADE + TEST brains in parallel, then merges their outputs
// into a single EnsembleDecision via weighted voting with TEST veto override.
//
// Final weights default: CEO=0.4, TRADE=0.4, TEST=0.2 (but TEST veto is hard).
// Env override: MOE_ENSEMBLE_WEIGHTS="CEO:0.4,TRADE:0.4,TEST:0.2"
//
// Fail-safe semantics:
//   - If ANY brain throws → SAFE_SKIP with reason code.
//   - If TEST vetoFlag=true → VETO (regardless of CEO/TRADE).
//   - If BOTH CEO + TRADE approve (with confidence ≥ 0.5) and TEST ≠ VETO → ALLOW.
//   - If scores conflict → MANUAL_REVIEW (never silent).

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { CEOBrainService } from './brains/ceo-brain.service';
import { TRADEBrainService } from './brains/trade-brain.service';
import { TESTBrainService } from './brains/test-brain.service';
import { MoEContext } from './shared/moe-context';
import {
  BrainOutput,
  EnsembleDecision,
} from './shared/moe.contracts';
import { BrainType, ExpertVote, MoEDecision } from './shared/moe.enums';
import { ClosedLoopLearnerService } from './learning/closed-loop-learner.service';

export interface EnsembleWeights {
  ceo: number;
  trade: number;
  test: number;
}

function parseWeights(): EnsembleWeights {
  const raw = process.env.MOE_ENSEMBLE_WEIGHTS;
  const def: EnsembleWeights = { ceo: 0.4, trade: 0.4, test: 0.2 };
  if (!raw) return def;
  try {
    const parts = raw.split(',').reduce<Record<string, number>>((acc, p) => {
      const [k, v] = p.split(':').map((x) => x.trim());
      const n = Number(v);
      if (k && Number.isFinite(n)) acc[k.toUpperCase()] = n;
      return acc;
    }, {});
    const ceo = Math.max(0, Math.min(1, parts.CEO ?? def.ceo));
    const trade = Math.max(0, Math.min(1, parts.TRADE ?? def.trade));
    const test = Math.max(0, Math.min(1, parts.TEST ?? def.test));
    const sum = ceo + trade + test || 1;
    return { ceo: ceo / sum, trade: trade / sum, test: test / sum };
  } catch {
    return def;
  }
}

function voteToScore(v: ExpertVote): number {
  if (v === ExpertVote.APPROVE) return 1;
  if (v === ExpertVote.REJECT) return -1;
  return 0;
}

@Injectable()
export class GlobalMoEOrchestratorService {
  private readonly logger = new Logger(GlobalMoEOrchestratorService.name);
  private readonly baseWeights: EnsembleWeights = parseWeights();
  private readonly allowThreshold = parseFloat(process.env.MOE_ALLOW_THRESHOLD || '0.3');
  private readonly skipThreshold = parseFloat(process.env.MOE_SKIP_THRESHOLD || '-0.2');
  private readonly healthWeighting = process.env.MOE_HEALTH_WEIGHTING !== 'false';
  private readonly healthFloor = parseFloat(process.env.MOE_HEALTH_FLOOR || '0.25');

  constructor(
    private readonly ceo: CEOBrainService,
    private readonly trade: TRADEBrainService,
    private readonly test: TESTBrainService,
    @Inject(forwardRef(() => ClosedLoopLearnerService))
    private readonly learner: ClosedLoopLearnerService,
  ) {}

  getWeights(): EnsembleWeights {
    // Returns base (static) weights; effective (health-adjusted) weights are
    // exposed via getEffectiveWeights() and surfaced on every EnsembleDecision.
    return { ...this.baseWeights };
  }

  /**
   * Compute runtime-effective weights by scaling each brain's base weight
   * with its current synaptic-health (from ClosedLoopLearner.snapshot()).
   * A per-brain floor prevents a brain from being zeroed out entirely.
   */
  getEffectiveWeights(): EnsembleWeights {
    if (!this.healthWeighting) return this.getWeights();
    const snap = this.learner.snapshot();
    const healthMap: Record<string, number> = {};
    for (const s of snap) healthMap[s.brain] = s.health;
    const scale = (brain: BrainType, w: number) => {
      const h = healthMap[brain] ?? 1;
      return Math.max(this.healthFloor, Math.min(1, h)) * w;
    };
    const w = this.baseWeights;
    const ceoW = scale(BrainType.CEO, w.ceo);
    const tradeW = scale(BrainType.TRADE, w.trade);
    const testW = scale(BrainType.TEST, w.test);
    const sum = ceoW + tradeW + testW || 1;
    return { ceo: ceoW / sum, trade: tradeW / sum, test: testW / sum };
  }

  async evaluate(ctx: MoEContext): Promise<EnsembleDecision> {
    const started = Date.now();
    const reasonCodes: string[] = [];
    const effective = this.getEffectiveWeights();

    // Run all three in parallel. If any throws, we go SAFE_SKIP.
    let ceoOut: BrainOutput | null = null;
    let tradeOut: BrainOutput | null = null;
    let testOut: BrainOutput | null = null;
    try {
      const [c, t, ts] = await Promise.all([
        this.ceo.evaluate(ctx),
        this.trade.evaluate(ctx),
        this.test.evaluate(ctx),
      ]);
      ceoOut = c;
      tradeOut = t;
      testOut = ts;
    } catch (err) {
      this.logger.error(`MoE brain failure — SAFE_SKIP: ${(err as Error).message}`);
      return {
        decision: MoEDecision.SKIP,
        confidence: 0,
        reasonCodes: ['BRAIN_FAILURE_SAFE_SKIP', (err as Error).message.slice(0, 120)],
        brains: [],
        finalWeights: effective,
        timestampUtc: new Date().toISOString(),
      };
    }

    // TEST veto is hard — overrides everything.
    if (testOut.vetoFlag) {
      reasonCodes.push('TEST_MOE_VETO');
      for (const e of testOut.experts) {
        if (e.vote === ExpertVote.REJECT && (e.confidence ?? 0) >= 0.7) {
          reasonCodes.push(`TEST_${e.role}_REJECT`);
        }
      }
      return {
        decision: MoEDecision.VETO,
        confidence: testOut.aggregate.confidence,
        reasonCodes,
        brains: [ceoOut, tradeOut, testOut],
        finalWeights: effective,
        timestampUtc: new Date().toISOString(),
      };
    }

    // Weighted ensemble score (uses effective — health-adjusted — weights).
    const score =
      effective.ceo * voteToScore(ceoOut.aggregate.vote) * ceoOut.aggregate.confidence +
      effective.trade * voteToScore(tradeOut.aggregate.vote) * tradeOut.aggregate.confidence +
      effective.test * voteToScore(testOut.aggregate.vote) * testOut.aggregate.confidence;

    const confidence = Math.max(
      0,
      Math.min(
        1,
        effective.ceo * ceoOut.aggregate.confidence +
          effective.trade * tradeOut.aggregate.confidence +
          effective.test * testOut.aggregate.confidence,
      ),
    );

    let decision: MoEDecision;
    if (score >= this.allowThreshold) {
      decision = MoEDecision.ALLOW;
      reasonCodes.push(`ENSEMBLE_ALLOW_SCORE_${score.toFixed(2)}`);
    } else if (score <= this.skipThreshold) {
      decision = MoEDecision.SKIP;
      reasonCodes.push(`ENSEMBLE_SKIP_SCORE_${score.toFixed(2)}`);
    } else {
      decision = MoEDecision.MANUAL_REVIEW;
      reasonCodes.push(`ENSEMBLE_MANUAL_REVIEW_SCORE_${score.toFixed(2)}`);
    }

    // Append brain-level vote summary for traceability.
    reasonCodes.push(
      `CEO_${ceoOut.aggregate.vote}_${ceoOut.aggregate.confidence.toFixed(2)}`,
      `TRADE_${tradeOut.aggregate.vote}_${tradeOut.aggregate.confidence.toFixed(2)}`,
      `TEST_${testOut.aggregate.vote}_${testOut.aggregate.confidence.toFixed(2)}`,
    );

    this.logger.debug(
      `MoE ensemble: score=${score.toFixed(3)} decision=${decision} t=${Date.now() - started}ms w(C/T/Te)=${effective.ceo.toFixed(2)}/${effective.trade.toFixed(2)}/${effective.test.toFixed(2)}`,
    );

    return {
      decision,
      confidence: Number(confidence.toFixed(3)),
      reasonCodes,
      brains: [ceoOut, tradeOut, testOut],
      finalWeights: effective,
      timestampUtc: new Date().toISOString(),
    };
  }
}
