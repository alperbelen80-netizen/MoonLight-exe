// TEST-MoE Brain — deterministic red team. Pure rules, no LLM.
// Any REJECT with high confidence on OVERFIT_HUNTER or DATA_LEAK_DETECTOR
// triggers brain-level vetoFlag. Used downstream as a hard circuit breaker.

import { Injectable } from '@nestjs/common';
import { BrainOutput, ExpertOutput } from '../shared/moe.contracts';
import { BrainType, ExpertRole } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';
import { TEST_DETERMINISTIC_EXPERTS } from '../experts/test-experts';
import { aggregate } from '../gating/softmax-gating';

const TEST_PRIORS: Partial<Record<ExpertRole, number>> = {
  [ExpertRole.OVERFIT_HUNTER]: 0.8,
  [ExpertRole.DATA_LEAK_DETECTOR]: 0.9,
  [ExpertRole.BIAS_AUDITOR]: 0.5,
  [ExpertRole.ADVERSARIAL_ATTACKER]: 0.6,
  [ExpertRole.ROBUSTNESS_TESTER]: 0.5,
};

@Injectable()
export class TESTBrainService {
  async evaluate(ctx: MoEContext): Promise<BrainOutput> {
    const started = Date.now();
    const roles = Object.keys(TEST_DETERMINISTIC_EXPERTS) as ExpertRole[];
    const outputs: ExpertOutput[] = roles.map((role) =>
      TEST_DETERMINISTIC_EXPERTS[role as keyof typeof TEST_DETERMINISTIC_EXPERTS](ctx),
    );
    return aggregate(BrainType.TEST, outputs, TEST_PRIORS, {
      // TEST brain enforces strong veto via OVERFIT + DATA_LEAK + ADVERSARIAL.
      vetoTriggerRoles: [
        ExpertRole.OVERFIT_HUNTER,
        ExpertRole.DATA_LEAK_DETECTOR,
        ExpertRole.ADVERSARIAL_ATTACKER,
      ],
      approveThreshold: 0.1,
      rejectThreshold: -0.1,
    }, Date.now() - started);
  }
}
