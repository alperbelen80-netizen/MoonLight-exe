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

    // v2.6-6: routing score derived from registry priority (lower idx →
    // higher routing preference). Operators can override by setting
    // `BROKER_ROUTING_PRIORITY=FAKE,IQ_OPTION,OLYMP_TRADE,BINOMO,EXPERT_OPTION`.
    const routingScore = this.computeRoutingScore(brokerId);

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

  /**
   * v2.6-6 routing score heuristic.
   *
   * Priority ordering (high → low):
   *   1. operator override via `BROKER_ROUTING_PRIORITY` env (CSV).
   *   2. default: IQ_OPTION > OLYMP_TRADE > BINOMO > EXPERT_OPTION > FAKE.
   *
   * First broker in the list gets 100, each subsequent broker drops by
   * 15 points (floor 25). This makes the routing score a meaningful
   * 10% of the total without completely dominating latency/payout.
   */
  private computeRoutingScore(brokerId: string): number {
    const override = process.env.BROKER_ROUTING_PRIORITY;
    const priorityOrder = override
      ? override.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : ['IQ_OPTION', 'OLYMP_TRADE', 'BINOMO', 'EXPERT_OPTION', 'FAKE'];
    const idx = priorityOrder.indexOf(brokerId.toUpperCase());
    if (idx < 0) return 50; // unknown broker → neutral
    const score = 100 - idx * 15;
    return Math.max(25, score);
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
