import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ARTEngineService } from './art-engine/art-engine.service';
import { RiskProfileService } from './risk-profile.service';
import { RiskGuardrailService } from './risk-guardrail.service';
import { TripleCheckService } from './triple-check/triple-check.service';
import { M3DefensiveService } from './m3-defensive.service';
import { ApprovalQueueService } from './approval-queue.service';
import { CircuitBreakerService } from './fail-safe/circuit-breaker.service';
import { FailSafeEngineService } from './fail-safe/fail-safe-engine.service';
import { RiskController } from './risk.controller';
import { RiskProfile } from '../database/entities/risk-profile.entity';
import { ApprovalQueue } from '../database/entities/approval-queue.entity';
import { CircuitBreakerEvent } from '../database/entities/circuit-breaker-event.entity';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RiskProfile, ApprovalQueue, CircuitBreakerEvent]),
    AlertsModule,
  ],
  controllers: [RiskController],
  providers: [
    ARTEngineService,
    RiskProfileService,
    RiskGuardrailService,
    TripleCheckService,
    M3DefensiveService,
    ApprovalQueueService,
    CircuitBreakerService,
    FailSafeEngineService,
  ],
  exports: [
    ARTEngineService,
    RiskProfileService,
    RiskGuardrailService,
    TripleCheckService,
    M3DefensiveService,
    ApprovalQueueService,
    CircuitBreakerService,
    FailSafeEngineService,
  ],
})
export class RiskModule {}
