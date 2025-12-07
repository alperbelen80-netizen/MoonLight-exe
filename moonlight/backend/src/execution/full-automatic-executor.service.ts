import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { SemiAutomaticExecutor } from './semi-automatic-executor.service';
import { CircuitBreakerService } from '../risk/fail-safe/circuit-breaker.service';
import { FailSafeEngineService } from '../risk/fail-safe/fail-safe-engine.service';
import { ExecutionConfig } from '../database/entities/execution-config.entity';
import { ExecutionMode } from '../shared/enums/execution-mode.enum';

export interface FullAutoSafetyCheck {
  allowed: boolean;
  reason?: string;
  checks: {
    executionModeCheck: boolean;
    killSwitchCheck: boolean;
    dayCap: boolean;
    maxConcurrent: boolean;
    circuitBreaker: boolean;
  };
}

@Injectable()
export class FullAutomaticExecutor implements OnModuleInit {
  private readonly logger = new Logger(FullAutomaticExecutor.name);
  private enabled: boolean;
  private isProcessing = false;
  private dailyExecutionCount = 0;
  private lastResetDate: string;

  private readonly MAX_DAILY_EXECUTIONS = 100;
  private readonly MAX_CONCURRENT_EXECUTIONS = 5;

  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
    @InjectRepository(ExecutionConfig)
    private readonly execConfigRepo: Repository<ExecutionConfig>,
    private readonly semiAutoExecutor: SemiAutomaticExecutor,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly failSafeEngine: FailSafeEngineService,
  ) {
    this.enabled = process.env.FULL_AUTO_ENABLED === 'true';
    this.lastResetDate = new Date().toISOString().split('T')[0];
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Full-Auto Executor DISABLED');
      return;
    }

    this.logger.warn(
      '⚠️ FULL-AUTO EXECUTOR ENABLED - Signals will execute WITHOUT manual approval',
    );
    this.logger.warn('⚠️ Ensure kill-switch and circuit breakers are properly configured');
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processNewSignals(): Promise<void> {
    if (!this.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const safetyCheck = await this.performSafetyChecks();

      if (!safetyCheck.allowed) {
        this.logger.warn(
          `Full-Auto processing skipped: ${safetyCheck.reason}`,
        );
        return;
      }

      const newSignals = await this.liveSignalRepo.find({
        where: { status: 'NEW' },
        take: 10,
        order: { timestamp_utc: 'ASC' },
      });

      if (newSignals.length === 0) {
        return;
      }

      this.logger.log(
        `Full-Auto processing ${newSignals.length} new signals`,
      );

      for (const signal of newSignals) {
        if (this.dailyExecutionCount >= this.MAX_DAILY_EXECUTIONS) {
          this.logger.warn('Daily execution limit reached');
          break;
        }

        const result = await this.semiAutoExecutor.executeApprovedSignal(
          signal.id,
          'ACC_DEFAULT',
        );

        if (result.success) {
          this.dailyExecutionCount++;
          this.logger.log(
            `Full-Auto executed: ${signal.id} (${this.dailyExecutionCount}/${this.MAX_DAILY_EXECUTIONS})`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      this.logger.error(
        `Full-Auto processing error: ${error?.message}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async performSafetyChecks(): Promise<FullAutoSafetyCheck> {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailyExecutionCount = 0;
      this.lastResetDate = today;
    }

    const checks = {
      executionModeCheck: false,
      killSwitchCheck: false,
      dayCap: false,
      maxConcurrent: false,
      circuitBreaker: false,
    };

    const execConfig = await this.execConfigRepo.findOne({
      where: { id: 'GLOBAL' },
    });

    if (execConfig?.mode !== ExecutionMode.AUTO) {
      return {
        allowed: false,
        reason: `Execution mode is ${execConfig?.mode}, not AUTO`,
        checks,
      };
    }
    checks.executionModeCheck = true;

    if (this.circuitBreakerService.isBlocked('GLOBAL')) {
      return {
        allowed: false,
        reason: 'Circuit breaker active (kill-switch or fail-safe)',
        checks,
      };
    }
    checks.killSwitchCheck = true;
    checks.circuitBreaker = true;

    if (this.dailyExecutionCount >= this.MAX_DAILY_EXECUTIONS) {
      return {
        allowed: false,
        reason: `Daily execution limit reached (${this.dailyExecutionCount}/${this.MAX_DAILY_EXECUTIONS})`,
        checks,
      };
    }
    checks.dayCap = true;

    const activeSignals = await this.liveSignalRepo.count({
      where: { status: 'MARKED_EXECUTED' },
    });

    if (activeSignals >= this.MAX_CONCURRENT_EXECUTIONS) {
      return {
        allowed: false,
        reason: `Max concurrent executions (${activeSignals}/${this.MAX_CONCURRENT_EXECUTIONS})`,
        checks,
      };
    }
    checks.maxConcurrent = true;

    return {
      allowed: true,
      checks,
    };
  }

  getStatus(): {
    enabled: boolean;
    processing: boolean;
    dailyCount: number;
    maxDaily: number;
  } {
    return {
      enabled: this.enabled,
      processing: this.isProcessing,
      dailyCount: this.dailyExecutionCount,
      maxDaily: this.MAX_DAILY_EXECUTIONS,
    };
  }
}
