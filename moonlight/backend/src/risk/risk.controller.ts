import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApprovalQueueService } from './approval-queue.service';
import { CircuitBreakerService } from './fail-safe/circuit-breaker.service';

@Controller('risk')
export class RiskController {
  constructor(
    private readonly approvalQueueService: ApprovalQueueService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Get('approval/pending')
  async getPendingApprovals(@Body() body: { limit?: number }) {
    return this.approvalQueueService.listPending(body.limit || 20);
  }

  @Post('approval/:id/approve')
  async approveItem(
    @Param('id') id: string,
    @Body() body: { decided_by: string },
  ) {
    await this.approvalQueueService.approve(id, body.decided_by);
    return { status: 'APPROVED', id };
  }

  @Post('approval/:id/reject')
  async rejectItem(
    @Param('id') id: string,
    @Body() body: { decided_by: string },
  ) {
    await this.approvalQueueService.reject(id, body.decided_by);
    return { status: 'REJECTED', id };
  }

  @Get('circuit-breaker/state')
  async getCircuitBreakerState() {
    return {
      status: 'OK',
      message: 'Circuit breaker state endpoint',
    };
  }
}
