export interface BrokerLatencyMetrics {
  broker_id: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  latencies_ms: number[];
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
  avg_latency: number;
  last_updated: Date;
}

export interface BrokerHealthScore {
  broker_id: string;
  health_score: number;
  latency_score: number;
  reliability_score: number;
  payout_score: number;
  routing_score: number;
  is_available: boolean;
  last_check: Date;
}
