import { Injectable, Logger } from '@nestjs/common';
import { BrokerLatencyTracker } from './broker-latency-tracker.service';
import { BrokerHealthScore } from '../types/broker-metrics.types';
import { PayoutMatrixService } from '../payout/payout-matrix.service';

@Injectable()
export class BrokerScoringService {
  private readonly logger = new Logger(BrokerScoringService.name);

  private readonly LATENCY_WEIGHT = 0.35;
  private readonly RELIABILITY_WEIGHT = 0.25;
  private readonly PAYOUT_WEIGHT = 0.30;
  private readonly ROUTING_WEIGHT = 0.10;

  private readonly LATENCY_TARGET_P95 = 120;
  private readonly LATENCY_MAX_P95 = 1000;

  constructor(
    private readonly latencyTracker: BrokerLatencyTracker,
    private readonly payoutMatrix: PayoutMatrixService,
  ) {}

  async calculateBrokerScore(
    brokerId: string,
    symbol: string,
    expiryMinutes: number,
  ): Promise<BrokerHealthScore> {
    const latencyMetrics = this.latencyTracker.getMetrics(brokerId);

    let latencyScore = 100;
    let reliabilityScore = 100;

    if (latencyMetrics) {
      const p95 = latencyMetrics.p95_latency;

      if (p95 <= this.LATENCY_TARGET_P95) {
        latencyScore = 100;
      } else if (p95 >= this.LATENCY_MAX_P95) {
        latencyScore = 0;
      } else {
        latencyScore =
          100 *
          (1 - (p95 - this.LATENCY_TARGET_P95) / (this.LATENCY_MAX_P95 - this.LATENCY_TARGET_P95));
      }

      const successRate =
        latencyMetrics.total_requests > 0
          ? latencyMetrics.successful_requests / latencyMetrics.total_requests
          : 1;

      reliabilityScore = successRate * 100;
    }

    const payoutData = await this.payoutMatrix.getPayoutForSlot(symbol, expiryMinutes);
    const payoutRatio = payoutData?.payout_ratio || 0.85;
    const payoutScore = payoutRatio * 100;

    const routingScore = 100;

    const healthScore =
      latencyScore * this.LATENCY_WEIGHT +
      reliabilityScore * this.RELIABILITY_WEIGHT +
      payoutScore * this.PAYOUT_WEIGHT +
      routingScore * this.ROUTING_WEIGHT;

    const isAvailable = healthScore >= 40 && reliabilityScore >= 50;

    return {
      broker_id: brokerId,
      health_score: Math.round(healthScore),
      latency_score: Math.round(latencyScore),
      reliability_score: Math.round(reliabilityScore),
      payout_score: Math.round(payoutScore),
      routing_score: Math.round(routingScore),
      is_available: isAvailable,
      last_check: new Date(),
    };
  }

  async rankBrokersForSignal(
    brokerIds: string[],
    symbol: string,
    expiryMinutes: number,
  ): Promise<BrokerHealthScore[]> {
    const scores: BrokerHealthScore[] = [];

    for (const brokerId of brokerIds) {
      const score = await this.calculateBrokerScore(brokerId, symbol, expiryMinutes);
      scores.push(score);
    }

    scores.sort((a, b) => b.health_score - a.health_score);

    return scores;
  }
}
