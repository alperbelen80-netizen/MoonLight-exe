import { Controller, Get, Post } from '@nestjs/common';
import { ClosedLoopLearnerService } from './closed-loop-learner.service';

@Controller('moe/learning')
export class ClosedLoopController {
  constructor(private readonly svc: ClosedLoopLearnerService) {}

  @Get('snapshot')
  snapshot() {
    return this.svc.snapshot();
  }

  @Post('step')
  step() {
    return this.svc.step();
  }
}
