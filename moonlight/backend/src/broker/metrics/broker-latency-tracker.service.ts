import { Injectable, Logger } from '@nestjs/common';
import { BrokerLatencyMetrics, BrokerHealthScore } from '../types/broker-metrics.types';

@Injectable()
export class BrokerLatencyTracker {
  private readonly logger = new Logger(BrokerLatencyTracker.name);
  private metrics: Map<string, BrokerLatencyMetrics> = new Map();
  private readonly MAX_SAMPLES = 1000;

  recordLatency(brokerId: string, latencyMs: number, success: boolean): void {
    let metric = this.metrics.get(brokerId);

    if (!metric) {
      metric = {
        broker_id: brokerId,
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        latencies_ms: [],
        p50_latency: 0,
        p95_latency: 0,
        p99_latency: 0,
        avg_latency: 0,
        last_updated: new Date(),
      };
      this.metrics.set(brokerId, metric);
    }

    metric.total_requests++;

    if (success) {
      metric.successful_requests++;
      metric.latencies_ms.push(latencyMs);

      if (metric.latencies_ms.length > this.MAX_SAMPLES) {
        metric.latencies_ms.shift();
      }

      this.recalculatePercentiles(metric);
    } else {
      metric.failed_requests++;
    }

    metric.last_updated = new Date();
  }

  private recalculatePercentiles(metric: BrokerLatencyMetrics): void {
    const sorted = [...metric.latencies_ms].sort((a, b) => a - b);

    metric.avg_latency =
      sorted.reduce((sum, v) => sum + v, 0) / sorted.length;

    metric.p50_latency = this.getPercentile(sorted, 0.5);
    metric.p95_latency = this.getPercentile(sorted, 0.95);
    metric.p99_latency = this.getPercentile(sorted, 0.99);
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  getMetrics(brokerId: string): BrokerLatencyMetrics | null {
    return this.metrics.get(brokerId) || null;
  }

  getAllMetrics(): BrokerLatencyMetrics[] {
    return Array.from(this.metrics.values());
  }

  resetMetrics(brokerId: string): void {
    this.metrics.delete(brokerId);
    this.logger.log(`Metrics reset for broker: ${brokerId}`);
  }
}
