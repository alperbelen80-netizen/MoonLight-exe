import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CircuitBreakerEvent } from '../../database/entities/circuit-breaker-event.entity';
import { CircuitBreakerLevel } from '../../shared/enums/circuit-breaker-level.enum';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private activeBreakers: Map<string, { level: CircuitBreakerLevel; cooldownUntil?: Date }> = new Map();

  constructor(
    @InjectRepository(CircuitBreakerEvent)
    private readonly breakerEventRepo: Repository<CircuitBreakerEvent>,
  ) {}

  async apply(params: {
    level: CircuitBreakerLevel;
    scope: string;
    affectedIds: string[];
    reason: string;
    cooldownMinutes?: number;
    triggeredBy?: string;
  }): Promise<void> {
    const { level, scope, affectedIds, reason, cooldownMinutes, triggeredBy } = params;

    const cooldownUntil = cooldownMinutes
      ? new Date(Date.now() + cooldownMinutes * 60000)
      : undefined;

    const event = this.breakerEventRepo.create({
      level,
      scope,
      affected_ids: JSON.stringify(affectedIds),
      reason,
      triggered_at_utc: new Date(),
      triggered_by: triggeredBy || 'SYSTEM',
      cooldown_until_utc: cooldownUntil,
    });

    await this.breakerEventRepo.save(event);

    const key = `${level}_${scope}_${affectedIds.join('_')}`;
    this.activeBreakers.set(key, { level, cooldownUntil });

    this.logger.warn(
      `Circuit Breaker ${level} applied: scope=${scope}, reason=${reason}`,
    );
  }

  isBlocked(scope: string): boolean {
    const now = new Date();

    for (const [key, breaker] of this.activeBreakers) {
      if (key.includes(scope)) {
        if (breaker.cooldownUntil && now > breaker.cooldownUntil) {
          this.activeBreakers.delete(key);
          this.logger.log(`Circuit Breaker ${key} cooldown expired, releasing`);
        } else {
          return true;
        }
      }
    }

    return false;
  }

  clearAll(): void {
    this.activeBreakers.clear();
  }
}
