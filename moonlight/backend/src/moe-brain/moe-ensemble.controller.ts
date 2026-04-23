import { Body, Controller, HttpException, HttpStatus, Post, Get } from '@nestjs/common';
import { GlobalMoEOrchestratorService } from './global-moe-orchestrator.service';
import { MoEContext } from './shared/moe-context';
import { Eye2DecisionAuditorService } from '../trinity-oversight/eye2-decision-auditor.service';

@Controller('moe')
export class MoeEnsembleController {
  constructor(
    private readonly orchestrator: GlobalMoEOrchestratorService,
    private readonly auditor: Eye2DecisionAuditorService,
  ) {}

  @Get('weights')
  weights() {
    return this.orchestrator.getWeights();
  }

  @Post('evaluate')
  async evaluate(@Body() body: MoEContext) {
    if (!body || typeof body !== 'object') {
      throw new HttpException('body_required', HttpStatus.BAD_REQUEST);
    }
    if (!body.symbol || !body.timeframe || !body.direction) {
      throw new HttpException(
        'symbol, timeframe, direction are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const decision = await this.orchestrator.evaluate(body);
    // Trinity GÖZ-2 audit entry.
    this.auditor.record(
      body.signalId || `${body.symbol}-${Date.now()}`,
      decision.reasonCodes,
    );
    return decision;
  }
}
