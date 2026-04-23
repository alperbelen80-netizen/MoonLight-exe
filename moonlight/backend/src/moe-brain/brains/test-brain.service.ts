// TEST-MoE Brain — deterministic red team. Pure rules, no LLM.
// V2.2: priors are read from ClosedLoopLearner.

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { BrainOutput, ExpertOutput } from '../shared/moe.contracts';
import { BrainType, ExpertRole } from '../shared/moe.enums';
import { MoEContext } from '../shared/moe-context';
import { TEST_DETERMINISTIC_EXPERTS } from '../experts/test-experts';
import { aggregate } from '../gating/softmax-gating';
import { ClosedLoopLearnerService } from '../learning/closed-loop-learner.service';

@Injectable()
export class TESTBrainService {
  constructor(
    @Inject(forwardRef(() => ClosedLoopLearnerService))
    private readonly learner: ClosedLoopLearnerService,
  ) {}

  async evaluate(ctx: MoEContext): Promise<BrainOutput> {
    const started = Date.now();
    const priors = this.learner.getPriors(BrainType.TEST);
    const roles = Object.keys(TEST_DETERMINISTIC_EXPERTS) as ExpertRole[];
    const outputs: ExpertOutput[] = roles.map((role) =>
      TEST_DETERMINISTIC_EXPERTS[role as keyof typeof TEST_DETERMINISTIC_EXPERTS](ctx),
    );
    return aggregate(BrainType.TEST, outputs, priors, {
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
