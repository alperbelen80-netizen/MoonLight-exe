// MoonLight V2.1-B — Closed-loop learning service.
//
// Consumes:
//   - Eye2 DecisionAuditor reason codes (stream of recent outcomes).
//   - Current MoE priors (per-expert weights inside each brain).
// Produces:
//   - Adjusted priors via SynapticRulesService (clamped, guardrailed).
//
// This is the first real closed-loop path: as audit records accumulate,
// experts that keep showing up in VETO / REJECT reason codes become
// louder (via ANTI_HEBBIAN on counter-trend firings), while experts
// that show in APPROVE decisions get Hebbian reinforcement.
//
// Safety:
//   - Never mutates weights unless TrainingMode = ON.
//   - Uses SynapticRulesService which hard-clamps to [minWeight, maxWeight].
//   - Has its own kill switch env: CLOSED_LOOP_DISABLED=true.

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Eye2DecisionAuditorService } from '../../trinity-oversight/eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from '../../trinity-oversight/eye3-topology-governor.service';
import { SynapticRulesService } from '../synaptic/synaptic-rules.service';
import { SynapticRule, BrainType, ExpertRole } from '../shared/moe.enums';
import { TrainingMode } from '../../trinity-oversight/shared/trinity.enums';
import { ExpertPrior } from '../../database/entities/expert-prior.entity';

export interface PriorMap {
  [ExpertRole.TREND]?: number;
  [ExpertRole.MEAN_REVERSION]?: number;
  [ExpertRole.VOLATILITY]?: number;
  [ExpertRole.NEWS]?: number;
  [ExpertRole.MACRO]?: number;
  [ExpertRole.ENTRY]?: number;
  [ExpertRole.EXIT]?: number;
  [ExpertRole.SLIPPAGE]?: number;
  [ExpertRole.PAYOUT]?: number;
  [ExpertRole.SESSION]?: number;
  [ExpertRole.OVERFIT_HUNTER]?: number;
  [ExpertRole.DATA_LEAK_DETECTOR]?: number;
  [ExpertRole.BIAS_AUDITOR]?: number;
  [ExpertRole.ADVERSARIAL_ATTACKER]?: number;
  [ExpertRole.ROBUSTNESS_TESTER]?: number;
}

export interface ClosedLoopSnapshot {
  brain: BrainType;
  updatedAt: string;
  priors: Partial<Record<ExpertRole, number>>;
  health: number; // average weight magnitude, 0..1
}

@Injectable()
export class ClosedLoopLearnerService implements OnModuleInit {
  private readonly logger = new Logger(ClosedLoopLearnerService.name);
  private readonly disabled = process.env.CLOSED_LOOP_DISABLED === 'true';
  private readonly persistEnabled: boolean;

  private priors: Record<BrainType, Partial<Record<ExpertRole, number>>> = {
    [BrainType.CEO]: {
      [ExpertRole.TREND]: 0.6,
      [ExpertRole.MEAN_REVERSION]: 0.2,
      [ExpertRole.VOLATILITY]: 0.5,
      [ExpertRole.NEWS]: 0.3,
      [ExpertRole.MACRO]: 0.3,
    },
    [BrainType.TRADE]: {
      [ExpertRole.ENTRY]: 0.5,
      [ExpertRole.EXIT]: 0.3,
      [ExpertRole.SLIPPAGE]: 0.4,
      [ExpertRole.PAYOUT]: 0.7,
      [ExpertRole.SESSION]: 0.3,
    },
    [BrainType.TEST]: {
      [ExpertRole.OVERFIT_HUNTER]: 0.8,
      [ExpertRole.DATA_LEAK_DETECTOR]: 0.9,
      [ExpertRole.BIAS_AUDITOR]: 0.5,
      [ExpertRole.ADVERSARIAL_ATTACKER]: 0.6,
      [ExpertRole.ROBUSTNESS_TESTER]: 0.5,
    },
  };

  constructor(
    private readonly eye2: Eye2DecisionAuditorService,
    private readonly eye3: Eye3TopologyGovernorService,
    private readonly synaptic: SynapticRulesService,
    @Optional()
    @InjectRepository(ExpertPrior)
    private readonly priorRepo?: Repository<ExpertPrior>,
  ) {
    this.persistEnabled = !!priorRepo && process.env.CLOSED_LOOP_PERSIST !== 'false';
  }

  async onModuleInit(): Promise<void> {
    if (!this.persistEnabled || !this.priorRepo) return;
    try {
      const rows = await this.priorRepo.find();
      if (rows.length === 0) {
        this.logger.log('ExpertPrior table empty; using defaults.');
        return;
      }
      for (const r of rows) {
        const brain = r.brain as BrainType;
        const role = r.role as ExpertRole;
        if (!this.priors[brain]) continue;
        this.priors[brain][role] = r.weight;
      }
      this.logger.log(`Loaded ${rows.length} persisted expert priors from DB`);
    } catch (err) {
      this.logger.warn(`ExpertPrior load failed: ${(err as Error).message}`);
    }
  }

  private async persistPriors(): Promise<void> {
    if (!this.persistEnabled || !this.priorRepo) return;
    try {
      const rows: ExpertPrior[] = [];
      const now = new Date().toISOString();
      for (const brain of [BrainType.CEO, BrainType.TRADE, BrainType.TEST]) {
        for (const [role, weight] of Object.entries(this.priors[brain])) {
          if (typeof weight !== 'number') continue;
          rows.push({
            id: `${brain}__${role}`,
            brain,
            role,
            weight,
            updated_at_utc: now,
          } as ExpertPrior);
        }
      }
      await this.priorRepo.save(rows);
    } catch (err) {
      this.logger.warn(`ExpertPrior persist failed: ${(err as Error).message}`);
    }
  }

  getPriors(brain: BrainType): Partial<Record<ExpertRole, number>> {
    return { ...(this.priors[brain] || {}) };
  }

  setPriors(brain: BrainType, patch: Partial<Record<ExpertRole, number>>): void {
    this.priors[brain] = { ...this.priors[brain], ...patch };
  }

  /**
   * Run one learning step using current audit state.
   * Returns the snapshot of new priors per brain.
   */
  step(): { ran: boolean; reason: string; snapshots?: ClosedLoopSnapshot[] } {
    if (this.disabled) return { ran: false, reason: 'CLOSED_LOOP_DISABLED' };
    if (this.eye3.getTrainingMode() !== TrainingMode.ON) {
      return { ran: false, reason: `TRAINING_MODE_${this.eye3.getTrainingMode()}` };
    }

    const audit = this.eye2.report();
    if (audit.auditedCount === 0) {
      return { ran: false, reason: 'NO_AUDIT_DATA' };
    }

    const codes = audit.recentReasonCodes;
    const out: ClosedLoopSnapshot[] = [];
    for (const brain of [BrainType.CEO, BrainType.TRADE, BrainType.TEST]) {
      const current = this.priors[brain];
      const updated: Partial<Record<ExpertRole, number>> = { ...current };
      for (const [role, w] of Object.entries(current) as [ExpertRole, number][]) {
        // Build x,y signal based on how often this role's reason codes fired.
        const hits = codes.filter((c) => c.includes(role)).length;
        const ratio = codes.length > 0 ? hits / codes.length : 0;
        // x = novelty signal (did this expert fire often?)
        // y = outcome proxy (APPROVE vs REJECT) — crude: if role is also in
        //     a REJECT code, y tends negative.
        const rejectHits = codes.filter((c) => c.includes(role) && /REJECT|VETO/.test(c)).length;
        const approveHits = hits - rejectHits;
        const y = hits === 0 ? 0 : (approveHits - rejectHits) / Math.max(1, hits);
        const x = Math.min(1, Math.max(-1, ratio * 2 - 1)); // center around 0

        const rule =
          brain === BrainType.TEST
            ? SynapticRule.ANTI_HEBBIAN // TEST strengthens rejections
            : SynapticRule.HEBBIAN;

        const upd = this.synaptic.apply(rule, w, x, y);
        updated[role] = upd.after;
      }
      this.priors[brain] = updated;
      const vals = Object.values(updated).filter((v) => typeof v === 'number') as number[];
      const health = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      out.push({
        brain,
        updatedAt: new Date().toISOString(),
        priors: updated,
        health: Number(health.toFixed(3)),
      });
    }
    // Cross-pollinate synaptic health into GÖZ-3.
    const avg = out.reduce((a, b) => a + b.health, 0) / out.length;
    this.eye3.setSynapticHealth(avg);
    this.logger.log(
      `closed-loop step: codes=${codes.length} health=${avg.toFixed(3)}`,
    );
    // V2.4-A: best-effort persist (fire-and-forget, but awaited inside try).
    void this.persistPriors();
    return { ran: true, reason: 'APPLIED', snapshots: out };
  }

  snapshot(): ClosedLoopSnapshot[] {
    return [BrainType.CEO, BrainType.TRADE, BrainType.TEST].map((brain) => {
      const priors = { ...this.priors[brain] };
      const vals = Object.values(priors).filter((v) => typeof v === 'number') as number[];
      const health = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return {
        brain,
        updatedAt: new Date().toISOString(),
        priors,
        health: Number(health.toFixed(3)),
      };
    });
  }
}
