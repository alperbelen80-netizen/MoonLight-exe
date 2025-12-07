import { Injectable, Logger } from '@nestjs/common';
import { BrokerScoringService } from './metrics/broker-scoring.service';
import { BrokerAdapterInterface } from './adapters/broker-adapter.interface';
import { SessionManagerService } from './session/session-manager.service';
import { SessionHealth } from '../shared/enums/session-health.enum';

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

  private readonly AVAILABLE_BROKERS = [
    { id: 'FAKE_BROKER', name: 'FakeBroker', priority: 1 },
    { id: 'IQ_OPTION', name: 'IQ Option', priority: 2 },
    { id: 'BINANCE_SPOT', name: 'Binance Spot', priority: 3 },
  ];

  constructor(
    private readonly brokerScoring: BrokerScoringService,
    private readonly sessionManager: SessionManagerService,
  ) {}

  async selectBrokerForSignal(
    context: RoutingContext,
  ): Promise<BrokerSelectionResult> {
    const { symbol, expiryMinutes, accountIds, preferredBroker } = context;

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

    for (const broker of this.AVAILABLE_BROKERS) {
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
        brokerId: 'FAKE_BROKER',
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

  private async isBrokerAvailable(
    brokerId: string,
    accountIds: string[],
  ): Promise<boolean> {
    if (accountIds.length === 0) {
      return true;
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
    return this.AVAILABLE_BROKERS;
  }
}
