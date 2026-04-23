import { Controller, Get, Post } from '@nestjs/common';
import { ClosedLoopLearnerService } from './closed-loop-learner.service';
import { ClosedLoopSchedulerService } from './closed-loop-scheduler.service';

@Controller('moe/learning')
export class ClosedLoopController {
  constructor(
    private readonly svc: ClosedLoopLearnerService,
    private readonly scheduler: ClosedLoopSchedulerService,
  ) {}

  @Get('snapshot')
  snapshot() {
    return this.svc.snapshot();
  }

  @Post('step')
  step() {
    return this.svc.step();
  }

  @Get('scheduler')
  schedulerStatus() {
    return {
      enabled: this.scheduler.isEnabled(),
      history: this.scheduler.getHistory().slice(-20),
    };
  }

  @Get('scheduler/history')
  async schedulerHistory() {
    return this.scheduler.getPersistedHistory(100);
  }

  @Post('scheduler/tick')
  async manualTick() {
    return this.scheduler.tick();
  }
}
