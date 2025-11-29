import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApprovalQueueService } from './approval-queue.service';
import { CircuitBreakerService } from './fail-safe/circuit-breaker.service';
import { CircuitBreakerLevel } from '../shared/enums/circuit-breaker-level.enum';
import { AlertsService } from '../alerts/alerts.service';
import { AlertSeverity } from '../shared/dto/alert.dto';

@Controller('risk')
export class RiskController {
  constructor(
    private readonly approvalQueueService: ApprovalQueueService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly alertsService: AlertsService,
  ) {}

  @Get('approval/pending')
  async getPendingApprovals(@Body() body?: { limit?: number }) {
    return this.approvalQueueService.listPending(body?.limit || 20);
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
      level: 'NONE',
      message: 'Circuit breaker state',
    };
  }

  @Post('kill-switch/activate')
  async activateKillSwitch(@Body() body: { reason: string }) {
    await this.circuitBreakerService.apply({
      level: CircuitBreakerLevel.L3_GLOBAL,
      scope: 'GLOBAL',
      affectedIds: ['ALL'],
      reason: body.reason || 'MANUAL_KILL_SWITCH',
      triggeredBy: 'OWNER',
    });

    await this.alertsService.createAlert({
      source: 'RISK_CONTROLLER',
      severity: AlertSeverity.CRITICAL,
      category: 'KILL_SWITCH',
      message: `Kill-Switch activated: ${body.reason}`,
      autoAction: 'CIRCUIT_BREAKER_L3_GLOBAL',
    });

    return { status: 'KILL_SWITCH_ACTIVATED', reason: body.reason };
  }

  @Post('kill-switch/deactivate')
  async deactivateKillSwitch() {
    this.circuitBreakerService.clearAll();

    await this.alertsService.createAlert({
      source: 'RISK_CONTROLLER',
      severity: AlertSeverity.WARNING,
      category: 'KILL_SWITCH',
      message: 'Kill-Switch deactivated by owner',
      autoAction: 'CIRCUIT_BREAKER_CLEARED',
    });

    return { status: 'KILL_SWITCH_DEACTIVATED' };
  }
}
