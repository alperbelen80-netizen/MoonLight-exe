import { IsString, IsEnum, IsISO8601, IsOptional, IsNumber } from 'class-validator';

export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

export class AlertDTO {
  @IsString()
  alert_id: string;

  @IsString()
  source: string;

  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @IsString()
  category: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  details?: string;

  @IsEnum(AlertStatus)
  status: AlertStatus;

  @IsString()
  @IsOptional()
  auto_action?: string;

  @IsString()
  @IsOptional()
  owner_action?: string;

  @IsISO8601({ strict: true })
  created_at_utc: string;

  @IsISO8601({ strict: true })
  @IsOptional()
  resolved_at_utc?: string;

  @IsString()
  @IsOptional()
  runbook_link?: string;
}
