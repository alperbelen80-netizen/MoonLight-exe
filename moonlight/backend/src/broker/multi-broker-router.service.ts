import { Injectable, Logger } from '@nestjs/common';
import { BrokerScoringService } from './metrics/broker-scoring.service';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealth } from '../shared/enums/session-health.enum';
import { BrokerAdapterRegistry, SupportedBrokerId } from './adapters/broker-adapter.registry';

export interface BrokerSelectionResult {
  brokerId: string;
  score: number;
  reason: string;
  fallbackUsed: boolean;
}

export interface RoutingContext {
  symbol: string;
  timeframe: string;
  expiryMinutes: number;
  accountIds: string[];
  preferredBroker?: string;
}

@Injectable()
export class MultiBrokerRouter {
  private readonly logger = new Logger(MultiBrokerRouter.name);

  constructor(
    private readonly brokerScoring: BrokerScoringService,
    private readonly sessionManager: SessionManagerService,
    private readonly registry: BrokerAdapterRegistry,
  ) {}

  /**
   * Resolve the list of available brokers from the live BrokerAdapterRegistry.
   * Priority is implicit via registry order (FAKE → IQ_OPTION → OLYMP_TRADE → BINOMO → EXPERT_OPTION).
   */
  private listAvailableBrokers(): Array<{ id: string; name: string; priority: number }> {
    return this.registry.listIds().map((id, idx) => ({
      id,
      name: id,
      priority: idx + 1,
    }));
  }

  async selectBrokerForSignal(
    context: RoutingContext,
  ): Promise<BrokerSelectionResult> {
    const { symbol, expiryMinutes, accountIds, preferredBroker } = context;
    const allBrokers = this.listAvailableBrokers();

    if (preferredBroker) {
      const isAvailable = await this.isBrokerAvailable(preferredBroker, accountIds);

      if (isAvailable) {
        const score = await this.brokerScoring.calculateBrokerScore(
          preferredBroker,
          symbol,
          expiryMinutes,
        );

        if (score.is_available) {
          return {
            brokerId: preferredBroker,
            score: score.health_score,
            reason: 'Preferred broker available',
            fallbackUsed: false,
          };
        }
      }
    }

    const eligibleBrokers = [];

    for (const broker of allBrokers) {
      const isAvailable = await this.isBrokerAvailable(broker.id, accountIds);

      if (!isAvailable) {
        this.logger.debug(`Broker ${broker.id} not available (session/account issue)`);
        continue;
      }

      const score = await this.brokerScoring.calculateBrokerScore(
        broker.id,
        symbol,
        expiryMinutes,
      );

      if (score.is_available) {
        eligibleBrokers.push({
          brokerId: broker.id,
          brokerName: broker.name,
          score: score.health_score,
          latency: score.latency_score,
          reliability: score.reliability_score,
          payout: score.payout_score,
        });
      }
    }

    if (eligibleBrokers.length === 0) {
      this.logger.error('No eligible brokers available');

      return {
        brokerId: 'FAKE',
        score: 0,
        reason: 'FALLBACK: No brokers available',
        fallbackUsed: true,
      };
    }

    eligibleBrokers.sort((a, b) => b.score - a.score);

    const selected = eligibleBrokers[0];

    this.logger.log(
      `Broker selected: ${selected.brokerName} (score: ${selected.score.toFixed(1)}, latency: ${selected.latency}, payout: ${selected.payout})`,
    );

    return {
      brokerId: selected.brokerId,
      score: selected.score,
      reason: `Best score among ${eligibleBrokers.length} brokers`,
      fallbackUsed: false,
    };
  }

  /**
   * An adapter is considered available when EITHER:
   *  - Its own session health reports UP/DEGRADED (live-connected brokers), OR
   *  - At least one owner account for it reports UP/DEGRADED (legacy path).
   * This hybrid check lets FakeBroker (no real session) still be selectable
   * while also respecting per-account enforcement for live brokers.
   */
  private async isBrokerAvailable(
    brokerId: string,
    accountIds: string[],
  ): Promise<boolean> {
    try {
      const adapter = this.registry.get(brokerId as SupportedBrokerId);
      const adapterHealth = adapter.getSessionHealth();
      if (adapterHealth === SessionHealth.UP || adapterHealth === SessionHealth.DEGRADED) {
        return true;
      }
    } catch {
      // Unknown broker id; fall through to account check.
    }

    if (accountIds.length === 0) {
      // No accounts and adapter not UP → consider available only for FAKE (safe fallback).
      return brokerId === 'FAKE';
    }

    for (const accountId of accountIds) {
      const health = this.sessionManager.getSessionHealth(accountId);

      if (health === SessionHealth.UP || health === SessionHealth.DEGRADED) {
        return true;
      }
    }

    return false;
  }

  getAvailableBrokers(): Array<{ id: string; name: string; priority: number }> {
    return this.listAvailableBrokers();
  }
}
