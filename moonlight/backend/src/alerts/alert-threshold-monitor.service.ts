import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AlertDispatcherService } from './alert-dispatcher.service';
import { AIReasoningService } from '../ai-coach/ai-reasoning.service';
import { AIInsightsService } from '../ai-coach/ai-insights.service';

/**
 * AlertThresholdMonitor
 *
 * Polls key system metrics once per minute and dispatches outgoing
 * alerts when thresholds are crossed. State is kept in-memory so the
 * same condition does not retrigger on every tick (edge-triggered).
 */
@Injectable()
export class AlertThresholdMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertThresholdMonitor.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly approvalFloor: number;
  private lastApprovalState: 'above' | 'below' | 'unknown' = 'unknown';
  private lastCircuitState: 'open' | 'closed' | 'unknown' = 'unknown';

  constructor(
    private readonly dispatcher: AlertDispatcherService,
    private readonly reasoning: AIReasoningService,
    private readonly insights: AIInsightsService,
  ) {
    this.intervalMs = parseInt(process.env.ALERT_MONITOR_INTERVAL_MS || '60000', 10);
    this.approvalFloor = parseFloat(process.env.ALERT_APPROVAL_FLOOR || '0.3');
  }

  onModuleInit(): void {
    if (!this.dispatcher.isConfigured()) {
      this.logger.log('AlertThresholdMonitor: no webhooks configured, monitor idle');
      return;
    }
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.warn(e?.message)), this.intervalMs);
    this.logger.log(
      `AlertThresholdMonitor active (interval=${this.intervalMs}ms, approvalFloor=${this.approvalFloor})`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    // Rule 1: AI approval rate floor (rolling 1h)
    try {
      const insights = await this.insights.getDailyInsights(1, true);
      const rate = insights.totals.approval_rate;
      const state = rate < this.approvalFloor ? 'below' : 'above';
      if (state === 'below' && this.lastApprovalState !== 'below' && insights.totals.approved + insights.totals.rejected >= 10) {
        await this.dispatcher.dispatch({
          title: 'AI approval rate düştü',
          message: `Son 1 saatte AI onay oranı %${(rate * 100).toFixed(1)} — eşik %${(this.approvalFloor * 100).toFixed(0)}.`,
          severity: 'warning',
          context: insights.totals,
        });
      }
      this.lastApprovalState = state;
    } catch (err: any) {
      this.logger.warn(`AI approval rate probe failed: ${err?.message}`);
    }

    // Rule 2: Reasoning circuit breaker
    const rate = this.reasoning.getRateStatus();
    const newCircuit = rate.circuitOpen ? 'open' : 'closed';
    if (newCircuit !== this.lastCircuitState && this.lastCircuitState !== 'unknown') {
      await this.dispatcher.dispatch({
        title: `AI Reasoning Circuit ${newCircuit.toUpperCase()}`,
        message:
          newCircuit === 'open'
            ? 'AI reasoning circuit breaker OPEN — LLM geçici olarak devre dışı.'
            : 'AI reasoning circuit breaker CLOSED — LLM tekrar aktif.',
        severity: newCircuit === 'open' ? 'critical' : 'info',
        context: rate,
      });
    }
    this.lastCircuitState = newCircuit;
  }
}
