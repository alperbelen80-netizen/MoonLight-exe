// CEO-MoE Brain — strategic regime + direction confirmation.
// Hybrid: single Gemini call covering all 5 personas; deterministic fallback.

import { Injectable, Logger } from '@nestjs/common';
import { AICoachService } from '../../ai-coach/ai-coach.service';
import { BrainOutput, ExpertOutput } from '../shared/moe.contracts';
import { BrainType, ExpertRole } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';
import { CEO_DETERMINISTIC_EXPERTS } from '../experts/ceo-experts';
import {
  buildSystemPrompt,
  buildUserPayload,
  parseLlmExperts,
  PersonaBlock,
} from '../experts/llm-persona';
import { aggregate } from '../gating/softmax-gating';

const CEO_PERSONAS: PersonaBlock[] = [
  { role: ExpertRole.TREND, persona: 'Trend-following quant', focus: 'ADX, EMA slope, direction alignment' },
  { role: ExpertRole.MEAN_REVERSION, persona: 'Mean-reversion specialist', focus: 'RSI extremes, band exhaustion' },
  { role: ExpertRole.VOLATILITY, persona: 'Volatility regime analyst', focus: 'ATR%, BB width, regime label' },
  { role: ExpertRole.NEWS, persona: 'Macro news monitor', focus: 'High-impact event windows' },
  { role: ExpertRole.MACRO, persona: 'Session/liquidity strategist', focus: 'London/NY overlap, Asia thin' },
];

const CEO_PRIORS: Partial<Record<ExpertRole, number>> = {
  [ExpertRole.TREND]: 0.6,
  [ExpertRole.MEAN_REVERSION]: 0.2,
  [ExpertRole.VOLATILITY]: 0.5,
  [ExpertRole.NEWS]: 0.3,
  [ExpertRole.MACRO]: 0.3,
};

@Injectable()
export class CEOBrainService {
  private readonly logger = new Logger(CEOBrainService.name);
  private readonly timeoutMs = parseInt(process.env.MOE_LLM_TIMEOUT_MS || '10000', 10);

  constructor(private readonly coach: AICoachService) {}

  async evaluate(ctx: MoEContext): Promise<BrainOutput> {
    const started = Date.now();
    const allowedRoles = Object.keys(CEO_DETERMINISTIC_EXPERTS) as ExpertRole[];

    // Always compute deterministic outputs first; they are our floor.
    const fallbackOutputs: ExpertOutput[] = allowedRoles.map((role) =>
      CEO_DETERMINISTIC_EXPERTS[role as keyof typeof CEO_DETERMINISTIC_EXPERTS](ctx),
    );

    if (!this.coach.isAvailable() || process.env.MOE_LLM_DISABLED === 'true') {
      return aggregate(BrainType.CEO, fallbackOutputs, CEO_PRIORS, {
        vetoTriggerRoles: [ExpertRole.VOLATILITY],
      }, Date.now() - started);
    }

    try {
      const system = buildSystemPrompt('CEO', CEO_PERSONAS);
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
          setTimeout(() => reject(new Error('moe_ceo_llm_timeout')), this.timeoutMs),
        ),
      ]);

      const parsed = parseLlmExperts(raw, allowedRoles, this.logger);
      const merged: ExpertOutput[] = allowedRoles.map((role) => {
        const fromLlm = parsed.outputs[role];
        const fromDet = fallbackOutputs.find((e) => e.role === role)!;
        if (fromLlm) return { ...fromLlm, latencyMs: Date.now() - started };
        return fromDet;
      });
      return aggregate(BrainType.CEO, merged, CEO_PRIORS, {
        vetoTriggerRoles: [ExpertRole.VOLATILITY],
      }, Date.now() - started);
    } catch (err) {
      this.logger.warn(`CEO brain fell back to deterministic: ${(err as Error).message}`);
      return aggregate(BrainType.CEO, fallbackOutputs, CEO_PRIORS, {
        vetoTriggerRoles: [ExpertRole.VOLATILITY],
      }, Date.now() - started);
    }
  }
}
