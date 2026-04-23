// TRADE-MoE Brain — execution timing + micro-structure.

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AICoachService } from '../../ai-coach/ai-coach.service';
import { BrainOutput, ExpertOutput } from '../shared/moe.contracts';
import { BrainType, ExpertRole } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';
import { TRADE_DETERMINISTIC_EXPERTS } from '../experts/trade-experts';
import {
  buildSystemPrompt,
  buildUserPayload,
  parseLlmExperts,
  PersonaBlock,
} from '../experts/llm-persona';
import { aggregate } from '../gating/softmax-gating';
import { ClosedLoopLearnerService } from '../learning/closed-loop-learner.service';

const TRADE_PERSONAS: PersonaBlock[] = [
  { role: ExpertRole.ENTRY, persona: 'Entry micro-structure quant', focus: 'upstream confidence, price-vs-VWAP' },
  { role: ExpertRole.EXIT, persona: 'Fixed-time expiry planner', focus: 'TF validity for binary expiry' },
  { role: ExpertRole.SLIPPAGE, persona: 'Execution cost analyst', focus: 'spread/slippage bps' },
  { role: ExpertRole.PAYOUT, persona: 'Payout economics officer', focus: 'broker payout % break-even' },
  { role: ExpertRole.SESSION, persona: 'Session liquidity scout', focus: 'UTC hour activity windows' },
];

@Injectable()
export class TRADEBrainService {
  private readonly logger = new Logger(TRADEBrainService.name);
  private readonly timeoutMs = parseInt(process.env.MOE_LLM_TIMEOUT_MS || '10000', 10);

  constructor(
    private readonly coach: AICoachService,
    @Inject(forwardRef(() => ClosedLoopLearnerService))
    private readonly learner: ClosedLoopLearnerService,
  ) {}

  private getPriors(): Partial<Record<ExpertRole, number>> {
    return this.learner.getPriors(BrainType.TRADE);
  }

  async evaluate(ctx: MoEContext): Promise<BrainOutput> {
    const started = Date.now();
    const priors = this.getPriors();
    const allowedRoles = Object.keys(TRADE_DETERMINISTIC_EXPERTS) as ExpertRole[];
    const fallbackOutputs: ExpertOutput[] = allowedRoles.map((role) =>
      TRADE_DETERMINISTIC_EXPERTS[role as keyof typeof TRADE_DETERMINISTIC_EXPERTS](ctx),
    );

    if (!this.coach.isAvailable() || process.env.MOE_LLM_DISABLED === 'true') {
      return aggregate(BrainType.TRADE, fallbackOutputs, priors, {
        vetoTriggerRoles: [ExpertRole.PAYOUT],
      }, Date.now() - started);
    }

    try {
      const system = buildSystemPrompt('TRADE', TRADE_PERSONAS);
      const user = buildUserPayload(ctx);
      const raw = await Promise.race([
        this.coach.chat(
          [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          600,
        ),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('moe_trade_llm_timeout')), this.timeoutMs),
        ),
      ]);
      const parsed = parseLlmExperts(raw, allowedRoles, this.logger);
      const merged: ExpertOutput[] = allowedRoles.map((role) => {
        const fromLlm = parsed.outputs[role];
        const fromDet = fallbackOutputs.find((e) => e.role === role)!;
        if (fromLlm) return { ...fromLlm, latencyMs: Date.now() - started };
        return fromDet;
      });
      return aggregate(BrainType.TRADE, merged, priors, {
        vetoTriggerRoles: [ExpertRole.PAYOUT],
      }, Date.now() - started);
    } catch (err) {
      this.logger.warn(`TRADE brain fell back to deterministic: ${(err as Error).message}`);
      return aggregate(BrainType.TRADE, fallbackOutputs, priors, {
        vetoTriggerRoles: [ExpertRole.PAYOUT],
      }, Date.now() - started);
    }
  }
}
