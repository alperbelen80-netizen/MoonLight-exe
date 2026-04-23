import { Body, Controller, Get, Post, BadRequestException } from '@nestjs/common';
import { TrinityOversightService } from './trinity-oversight.service';
import { Eye3TopologyGovernorService } from './eye3-topology-governor.service';
import { Eye2DecisionAuditorService } from './eye2-decision-auditor.service';
import {
  ResourceBrokerService,
  ResourceBrokerSnapshot,
} from './resource-broker.service';

@Controller('trinity')
export class TrinityController {
  constructor(
    private readonly trinity: TrinityOversightService,
    private readonly eye3: Eye3TopologyGovernorService,
    private readonly eye2: Eye2DecisionAuditorService,
    private readonly resourceBroker: ResourceBrokerService,
  ) {}

  @Get('status')
  async status() {
    return this.trinity.getStatus();
  }

  @Get('audit')
  audit() {
    return this.eye2.report();
  }

  @Get('topology')
  topology() {
    return this.eye3.report();
  }

  @Post('training')
  training(@Body() body: { enabled?: boolean }) {
    const mode = this.eye3.setTrainingMode(Boolean(body?.enabled));
    return { trainingMode: mode };
  }

  // ---- V2.5-5 Resource Broker surface ---------------------------------

  /**
   * Current snapshot of the GÖZ-1 resource broker: CPU/GPU token pools,
   * active leases, queue depth, simulation flag, session totals.
   */
  @Get('resources')
  resources(): ResourceBrokerSnapshot {
    return this.resourceBroker.snapshot();
  }

  /**
   * Toggle the Ray-like GPU simulation pool. When enabled and GPU tokens
   * are zero, a default pool of 4 virtual GPUs becomes available.
   */
  @Post('simulation')
  simulation(@Body() body: { enabled?: boolean }): ResourceBrokerSnapshot {
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('{ enabled: boolean } required');
    }
    return this.resourceBroker.setSimulation(body.enabled);
  }
}
