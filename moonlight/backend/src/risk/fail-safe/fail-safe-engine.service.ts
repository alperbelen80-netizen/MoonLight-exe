import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerLevel } from '../../shared/enums/circuit-breaker-level.enum';

@Injectable()
export class FailSafeEngineService {
  private readonly logger = new Logger(FailSafeEngineService.name);

  private lossStreak: Map<string, number> = new Map();

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  checkDayCapTrigger(params: {
    todayLossPct: number;
    maxDailyLossPct: number;
    accountId: string;
  }): boolean {
    const { todayLossPct, maxDailyLossPct, accountId } = params;

    if (todayLossPct <= -maxDailyLossPct) {
      this.logger.warn(
        `DayCap trigger for ${accountId}: ${(todayLossPct * 100).toFixed(2)}% >= ${(maxDailyLossPct * 100).toFixed(2)}%`,
      );

      this.circuitBreakerService.apply({
        level: CircuitBreakerLevel.L1_PRODUCT,
        scope: 'ACCOUNT',
        affectedIds: [accountId],
        reason: 'DAYCAP_EXCEEDED',
        cooldownMinutes: 30,
      });

      return true;
    }

    return false;
  }

  recordTradeOutcome(strategyId: string, outcome: 'WIN' | 'LOSS'): void {
    if (outcome === 'WIN') {
      this.lossStreak.set(strategyId, 0);
    } else {
      const current = this.lossStreak.get(strategyId) || 0;
      this.lossStreak.set(strategyId, current + 1);

      const streak = this.lossStreak.get(strategyId)!;

      if (streak >= 5) {
        this.logger.warn(
          `Loss streak trigger for ${strategyId}: ${streak} consecutive losses`,
        );

        this.circuitBreakerService.apply({
          level: CircuitBreakerLevel.L1_PRODUCT,
          scope: 'STRATEGY',
          affectedIds: [strategyId],
          reason: 'LOSS_STREAK_5',
          cooldownMinutes: 30,
        });

        this.lossStreak.set(strategyId, 0);
      }
    }
  }

  resetLossStreak(strategyId: string): void {
    this.lossStreak.set(strategyId, 0);
  }
}
