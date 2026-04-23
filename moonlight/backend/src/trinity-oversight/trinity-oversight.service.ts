import { Injectable } from '@nestjs/common';
import { Eye1SystemObserverService } from './eye1-system-observer.service';
import { Eye2DecisionAuditorService } from './eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from './eye3-topology-governor.service';
import { TrinityConsensusService } from './trinity-consensus.service';
import { TrinityStatus } from './shared/trinity.contracts';

@Injectable()
export class TrinityOversightService {
  constructor(
    private readonly eye1: Eye1SystemObserverService,
    private readonly eye2: Eye2DecisionAuditorService,
    private readonly eye3: Eye3TopologyGovernorService,
    private readonly consensusSvc: TrinityConsensusService,
  ) {}

  async getStatus(): Promise<TrinityStatus> {
    const eye1 = await this.eye1.observe();
    const eye2 = this.eye2.report();
    const eye3 = this.eye3.report();
    const consensus = this.consensusSvc.consensus([
      eye1.verdict,
      eye2.verdict,
      eye3.verdict,
    ]);
    return {
      eye1,
      eye2,
      eye3,
      consensus,
      timestampUtc: new Date().toISOString(),
    };
  }
}
