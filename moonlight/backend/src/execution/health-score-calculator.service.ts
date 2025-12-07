import { Injectable, Logger } from '@nestjs/common';
import {
  TradeHealthMetrics,
  TradeHealthScore,
  HEALTH_SCORE_WEIGHTS,
} from '../shared/types/health-score.types';

@Injectable()
export class HealthScoreCalculator {
  private readonly logger = new Logger(HealthScoreCalculator.name);

  calculateTradeHealth(metrics: Partial<TradeHealthMetrics>): TradeHealthScore {
    const fullMetrics: TradeHealthMetrics = {
      latencyMs: metrics.latencyMs || 0,
      executionQuality: metrics.executionQuality ?? 100,
      routingQuality: metrics.routingQuality ?? 100,
      riskCompliance: metrics.riskCompliance ?? 100,
      reliability: metrics.reliability ?? 100,
      dataConsistency: metrics.dataConsistency ?? 100,
    };

    const latencyScore = this.scoreLatency(fullMetrics.latencyMs);

    const weightedScore =
      latencyScore * HEALTH_SCORE_WEIGHTS.latency +
      fullMetrics.executionQuality * HEALTH_SCORE_WEIGHTS.executionQuality +
      fullMetrics.routingQuality * HEALTH_SCORE_WEIGHTS.routingQuality +
      fullMetrics.riskCompliance * HEALTH_SCORE_WEIGHTS.riskCompliance +
      fullMetrics.reliability * HEALTH_SCORE_WEIGHTS.reliability +
      fullMetrics.dataConsistency * HEALTH_SCORE_WEIGHTS.dataConsistency;

    const score = Math.round(weightedScore);
    const color = this.getHealthColor(score);

    return {
      score,
      color,
      metrics: { ...fullMetrics, latencyMs: fullMetrics.latencyMs },
      timestamp: new Date(),
    };
  }

  private scoreLatency(latencyMs: number): number {
    if (latencyMs <= 100) return 100;
    if (latencyMs <= 200) return 95;
    if (latencyMs <= 500) return 85;
    if (latencyMs <= 1000) return 70;
    if (latencyMs <= 2000) return 50;
    return 30;
  }

  private getHealthColor(
    score: number,
  ): 'GREEN' | 'AMBER' | 'RED' | 'BLACKOUT' {
    if (score >= 80) return 'GREEN';
    if (score >= 60) return 'AMBER';
    if (score >= 40) return 'RED';
    return 'BLACKOUT';
  }

  calculateExecutionQuality(params: {
    orderAcked: boolean;
    slippagePips?: number;
    fillRate?: number;
  }): number {
    if (!params.orderAcked) return 0;

    let score = 100;

    if (params.slippagePips) {
      if (params.slippagePips > 5) score -= 30;
      else if (params.slippagePips > 2) score -= 15;
      else if (params.slippagePips > 1) score -= 5;
    }

    if (params.fillRate !== undefined) {
      score *= params.fillRate;
    }

    return Math.max(0, score);
  }

  calculateRoutingQuality(params: {
    targetPayout?: number;
    actualPayout?: number;
    brokerRejected: boolean;
  }): number {
    if (params.brokerRejected) return 0;

    let score = 100;

    if (params.targetPayout && params.actualPayout) {
      const payoutDiff = Math.abs(params.targetPayout - params.actualPayout);
      if (payoutDiff > 0.1) score -= 30;
      else if (payoutDiff > 0.05) score -= 15;
    }

    return score;
  }

  calculateRiskCompliance(params: {
    artApproved: boolean;
    guardrailsPassed: boolean;
    tripleCheckPassed: boolean;
  }): number {
    let score = 0;

    if (params.artApproved) score += 40;
    if (params.guardrailsPassed) score += 30;
    if (params.tripleCheckPassed) score += 30;

    return score;
  }

  calculateReliability(params: {
    timeout: boolean;
    errors: number;
  }): number {
    if (params.timeout) return 0;

    let score = 100;
    score -= params.errors * 20;

    return Math.max(0, score);
  }
}
