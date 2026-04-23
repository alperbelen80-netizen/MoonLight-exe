// MoonLight V2.0-γ — Execution-side MoE Gate.
//
// Thin adapter that upstream callers (LiveSignalEngine, Auto-Executor, FSM)
// can invoke to decide whether to proceed, skip, or hand off to MANUAL_REVIEW
// BEFORE committing an order. Strictly fail-closed: if MoE isn't reachable or
// the feature flag is off, it returns { allow: true } so baseline flow is
// unaffected (opt-in by config `MOE_GATE_ENABLED`).

import { Injectable, Logger } from '@nestjs/common';
import { GlobalMoEOrchestratorService } from '../moe-brain/global-moe-orchestrator.service';
import { MoEContext } from '../moe-brain/shared/moe-context';
import { MoEDecision } from '../moe-brain/shared/moe.enums';

export interface MoEGateResult {
  allow: boolean;
  decision: MoEDecision | 'DISABLED' | 'ERRORED';
  confidence: number;
  reasonCodes: string[];
}

@Injectable()
export class MoEGateService {
  private readonly logger = new Logger(MoEGateService.name);
  private readonly enabled: boolean;
  private readonly strict: boolean;

  constructor(private readonly orchestrator: GlobalMoEOrchestratorService) {
    this.enabled = process.env.MOE_GATE_ENABLED === 'true';
    this.strict = process.env.MOE_GATE_STRICT === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Gate a candidate signal. Returns { allow } plus diagnostic payload.
   * Policy:
   *   - disabled → allow, decision=DISABLED.
   *   - ALLOW → allow.
   *   - MANUAL_REVIEW → allow when non-strict (UI surfaces the flag); block when strict.
   *   - SKIP / VETO → block.
   *   - thrown/errored → fail-closed if strict, fail-open if non-strict (log).
   */
  async gate(ctx: MoEContext): Promise<MoEGateResult> {
    if (!this.enabled) {
      return {
        allow: true,
        decision: 'DISABLED',
        confidence: 0,
        reasonCodes: ['MOE_GATE_DISABLED'],
      };
    }
    try {
      const ens = await this.orchestrator.evaluate(ctx);
      let allow: boolean;
      switch (ens.decision) {
        case MoEDecision.ALLOW:
          allow = true;
          break;
        case MoEDecision.MANUAL_REVIEW:
          allow = !this.strict;
          break;
        case MoEDecision.SKIP:
        case MoEDecision.VETO:
        default:
          allow = false;
          break;
      }
      return {
        allow,
        decision: ens.decision,
        confidence: ens.confidence,
        reasonCodes: ens.reasonCodes,
      };
    } catch (err) {
      this.logger.warn(`MoE gate errored: ${(err as Error).message}`);
      return {
        allow: !this.strict,
        decision: 'ERRORED',
        confidence: 0,
        reasonCodes: [
          'MOE_GATE_ERROR',
          `${(err as Error).message.slice(0, 120)}`,
          this.strict ? 'STRICT_BLOCK' : 'NONSTRICT_ALLOW',
        ],
      };
    }
  }
}
