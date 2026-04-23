// MoonLight V2.2-A — Scheduled Closed-Loop Auto-Step.
//
// Uses @nestjs/schedule cron expression (default every 5 minutes) to invoke
// ClosedLoopLearnerService.step() WITH a prior safety check:
//   1. Global kill switch: CLOSED_LOOP_SCHEDULER_ENABLED must be 'true'.
//   2. GÖZ-1 System Observer must NOT be HALT.
//   3. Resource Broker must approve a weight=1 budget request.
// If any of the above fails, step is deferred and reason is reported.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ClosedLoopLearnerService } from './closed-loop-learner.service';
import { Eye1SystemObserverService } from '../../trinity-oversight/eye1-system-observer.service';
import { ResourceBrokerService } from '../../trinity-oversight/resource-broker.service';
import { OversightVerdict } from '../../trinity-oversight/shared/trinity.enums';
import { LearningTickHistory } from '../../database/entities/learning-tick-history.entity';

export interface SchedulerTick {
  at: string;
  ran: boolean;
  reason: string;
  brains?: number;
}

@Injectable()
export class ClosedLoopSchedulerService {
  private readonly logger = new Logger(ClosedLoopSchedulerService.name);
  private readonly enabled: boolean;
  private history: SchedulerTick[] = [];
  private readonly maxHistory = 100;

  constructor(
    private readonly learner: ClosedLoopLearnerService,
    private readonly eye1: Eye1SystemObserverService,
    private readonly broker: ResourceBrokerService,
    @InjectRepository(LearningTickHistory)
    private readonly tickRepo: Repository<LearningTickHistory>,
  ) {
    this.enabled = process.env.CLOSED_LOOP_SCHEDULER_ENABLED === 'true';
    if (!this.enabled) {
      this.logger.log('ClosedLoopScheduler is DISABLED (set CLOSED_LOOP_SCHEDULER_ENABLED=true).');
    } else {
      this.logger.log('ClosedLoopScheduler is ACTIVE (cron: every 5 minutes).');
    }
  }

  // NestJS will auto-register the cron when the class is a provider.
  // CronExpression.EVERY_5_MINUTES = '0 */5 * * * *'
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<SchedulerTick> {
    const tick = await this.tick();
    this.record(tick);
    // Best-effort persistence — never fail the scheduler if DB is down.
    try {
      await this.tickRepo.save(
        this.tickRepo.create({
          id: uuidv4(),
          at_utc: tick.at,
          ran: tick.ran ? 1 : 0,
          reason: tick.reason,
          brains: tick.brains ?? null,
          avgHealth: null,
        }),
      );
    } catch (err) {
      this.logger.warn(`Failed to persist scheduler tick: ${(err as Error).message}`);
    }
    return tick;
  }

  async getPersistedHistory(limit = 100): Promise<LearningTickHistory[]> {
    try {
      return await this.tickRepo.find({
        order: { at_utc: 'DESC' },
        take: Math.min(500, Math.max(1, limit)),
      });
    } catch {
      return [];
    }
  }

  async tick(): Promise<SchedulerTick> {
    const at = new Date().toISOString();
    if (!this.enabled) {
      return { at, ran: false, reason: 'SCHEDULER_DISABLED' };
    }
    // Layer 1: GÖZ-1 HALT check.
    try {
      const eye1 = await this.eye1.observe();
      if (eye1.verdict === OversightVerdict.HALT) {
        return { at, ran: false, reason: 'EYE1_HALT' };
      }
    } catch (err) {
      return { at, ran: false, reason: `EYE1_ERROR:${(err as Error).message.slice(0, 80)}` };
    }
    // Layer 2: Resource budget.
    const budget = this.broker.requestBudget(1);
    if (!budget.allowed) {
      return { at, ran: false, reason: `BUDGET_DENIED:${budget.reason ?? 'n/a'}` };
    }
    // Layer 3: delegate to learner (which has its own training-mode check).
    try {
      const out = this.learner.step();
      return {
        at,
        ran: out.ran,
        reason: out.reason,
        brains: out.snapshots?.length,
      };
    } catch (err) {
      return {
        at,
        ran: false,
        reason: `LEARNER_ERROR:${(err as Error).message.slice(0, 80)}`,
      };
    }
  }

  record(tick: SchedulerTick): void {
    this.history.push(tick);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }

  getHistory(): SchedulerTick[] {
    return [...this.history];
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
