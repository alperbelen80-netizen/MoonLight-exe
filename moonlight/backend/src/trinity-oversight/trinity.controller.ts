import { Body, Controller, Get, Post } from '@nestjs/common';
import { TrinityOversightService } from './trinity-oversight.service';
import { Eye3TopologyGovernorService } from './eye3-topology-governor.service';
import { Eye2DecisionAuditorService } from './eye2-decision-auditor.service';

@Controller('trinity')
export class TrinityController {
  constructor(
    private readonly trinity: TrinityOversightService,
    private readonly eye3: Eye3TopologyGovernorService,
    private readonly eye2: Eye2DecisionAuditorService,
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
}
