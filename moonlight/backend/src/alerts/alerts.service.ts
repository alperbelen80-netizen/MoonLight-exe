import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Alert } from '../database/entities/alert.entity';
import { AlertDTO, AlertSeverity, AlertStatus } from '../shared/dto/alert.dto';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async listAlerts(params: {
    severity?: AlertSeverity;
    status?: AlertStatus;
    limit?: number;
  }): Promise<AlertDTO[]> {
    const { severity, status, limit } = params;

    const queryBuilder = this.alertRepo.createQueryBuilder('alert');

    if (severity) {
      queryBuilder.andWhere('alert.severity = :severity', { severity });
    }

    if (status) {
      queryBuilder.andWhere('alert.status = :status', { status });
    }

    queryBuilder.orderBy('alert.created_at_utc', 'DESC');

    if (limit) {
      queryBuilder.take(limit);
    }

    const alerts = await queryBuilder.getMany();

    return alerts.map((a) => this.mapToDTO(a));
  }

  async ackAlert(id: string, ownerActionNote?: string): Promise<void> {
    await this.alertRepo.update(
      { alert_id: id },
      {
        status: AlertStatus.ACKNOWLEDGED,
        owner_action: ownerActionNote || 'ACKNOWLEDGED',
      },
    );

    this.logger.log(`Alert ${id} acknowledged`);
  }

  async resolveAlert(id: string, ownerActionNote?: string): Promise<void> {
    await this.alertRepo.update(
      { alert_id: id },
      {
        status: AlertStatus.RESOLVED,
        owner_action: ownerActionNote || 'RESOLVED',
        resolved_at_utc: new Date(),
      },
    );

    this.logger.log(`Alert ${id} resolved`);
  }

  async createAlert(params: {
    source: string;
    severity: AlertSeverity;
    category: string;
    message: string;
    details?: string;
    autoAction?: string;
    runbookLink?: string;
  }): Promise<AlertDTO> {
    const alert = this.alertRepo.create({
      alert_id: `ALERT_${uuidv4()}`,
      source: params.source,
      severity: params.severity,
      category: params.category,
      message: params.message,
      details: params.details,
      status: AlertStatus.OPEN,
      auto_action: params.autoAction,
      created_at_utc: new Date(),
      runbook_link: params.runbookLink,
    });

    await this.alertRepo.save(alert);

    this.logger.log(
      `Alert created: ${alert.alert_id} (${params.severity} - ${params.category})`,
    );

    return this.mapToDTO(alert);
  }

  private mapToDTO(alert: Alert): AlertDTO {
    return {
      alert_id: alert.alert_id,
      source: alert.source,
      severity: alert.severity as AlertSeverity,
      category: alert.category,
      message: alert.message,
      details: alert.details,
      status: alert.status as AlertStatus,
      auto_action: alert.auto_action,
      owner_action: alert.owner_action,
      created_at_utc: alert.created_at_utc.toISOString(),
      resolved_at_utc: alert.resolved_at_utc?.toISOString(),
      runbook_link: alert.runbook_link,
    };
  }
}
