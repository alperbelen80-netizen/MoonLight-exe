export interface TradeHealthMetrics {
  latencyMs: number;
  executionQuality: number;
  routingQuality: number;
  riskCompliance: number;
  reliability: number;
  dataConsistency: number;
}

export interface TradeHealthScore {
  score: number;
  color: 'GREEN' | 'AMBER' | 'RED' | 'BLACKOUT';
  metrics: TradeHealthMetrics;
  timestamp: Date;
}

export const HEALTH_SCORE_WEIGHTS = {
  latency: 0.20,
  executionQuality: 0.25,
  routingQuality: 0.15,
  riskCompliance: 0.20,
  reliability: 0.10,
  dataConsistency: 0.10,
};
