// GÖZ-1 — System Observer. Samples resource state + event loop lag.

import { Injectable } from '@nestjs/common';
import { ResourceBrokerService } from './resource-broker.service';
import { Eye1Report, ResourceSnapshot } from './shared/trinity.contracts';
import { OversightVerdict } from './shared/trinity.enums';

@Injectable()
export class Eye1SystemObserverService {
  constructor(private readonly broker: ResourceBrokerService) {}

  async observe(): Promise<Eye1Report> {
    const loopLagMs = await this.measureEventLoopLag();
    const { cpuUsagePct, memUsagePct } = this.broker.sample();
    const snapshot: ResourceSnapshot = {
      cpuUsagePct,
      memUsagePct,
      eventLoopLagMs: loopLagMs,
      queueDepth: 0, // wired up in later phases (Bull queues)
      latencyP95Ms: 0,
      timestampUtc: new Date().toISOString(),
    };

    const budget = this.broker.getBudgetPct();
    const worst = Math.max(cpuUsagePct, memUsagePct);
    const notes: string[] = [];
    let verdict: OversightVerdict = OversightVerdict.OK;

    if (worst >= budget) {
      verdict = OversightVerdict.HALT;
      notes.push(`worst_util ${worst.toFixed(1)}% >= budget ${budget}%`);
    } else if (worst >= budget * 0.85) {
      verdict = OversightVerdict.WARN;
      notes.push(`worst_util ${worst.toFixed(1)}% approaching budget ${budget}%`);
    }
    if (loopLagMs > 250) {
      verdict =
        verdict === OversightVerdict.HALT ? verdict : OversightVerdict.WARN;
      notes.push(`event_loop_lag ${loopLagMs.toFixed(0)}ms`);
    }

    return {
      eye: 'EYE_1_SYSTEM_OBSERVER',
      verdict,
      budgetPct: budget,
      snapshot,
      notes,
    };
  }

  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => resolve(Date.now() - start));
    });
  }
}
