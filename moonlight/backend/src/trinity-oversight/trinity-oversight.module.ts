import { Module } from '@nestjs/common';
import { ResourceBrokerService } from './resource-broker.service';
import { Eye1SystemObserverService } from './eye1-system-observer.service';
import { Eye2DecisionAuditorService } from './eye2-decision-auditor.service';
import { Eye3TopologyGovernorService } from './eye3-topology-governor.service';
import { TrinityConsensusService } from './trinity-consensus.service';
import { TrinityOversightService } from './trinity-oversight.service';
import { TrinityController } from './trinity.controller';

@Module({
  providers: [
    ResourceBrokerService,
    Eye1SystemObserverService,
    Eye2DecisionAuditorService,
    Eye3TopologyGovernorService,
    TrinityConsensusService,
    TrinityOversightService,
  ],
  controllers: [TrinityController],
  exports: [
    ResourceBrokerService,
    Eye1SystemObserverService,
    Eye2DecisionAuditorService,
    Eye3TopologyGovernorService,
    TrinityConsensusService,
    TrinityOversightService,
  ],
})
export class TrinityOversightModule {}
