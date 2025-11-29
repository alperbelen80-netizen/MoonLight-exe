import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertDTO, AlertSeverity, AlertStatus } from '../shared/dto/alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async listAlerts(
    @Query('severity') severity?: AlertSeverity,
    @Query('status') status?: AlertStatus,
    @Query('limit') limit?: string,
  ): Promise<AlertDTO[]> {
    return this.alertsService.listAlerts({
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post(':id/ack')
  async ackAlert(
    @Param('id') id: string,
    @Body() body?: { owner_action?: string },
  ) {
    await this.alertsService.ackAlert(id, body?.owner_action);
    return { status: 'ACKNOWLEDGED', id };
  }

  @Post(':id/resolve')
  async resolveAlert(
    @Param('id') id: string,
    @Body() body?: { owner_action?: string },
  ) {
    await this.alertsService.resolveAlert(id, body?.owner_action);
    return { status: 'RESOLVED', id };
  }
}
