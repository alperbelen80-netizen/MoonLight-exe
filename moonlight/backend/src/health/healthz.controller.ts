import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AICoachService } from '../ai-coach/ai-coach.service';
import { AIReasoningService } from '../ai-coach/ai-reasoning.service';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';

@Controller('healthz')
export class HealthzController {
  private readonly startedAt = Date.now();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly coach: AICoachService,
    private readonly reasoning: AIReasoningService,
    private readonly orchestrator: DataFeedOrchestrator,
  ) {}

  @Get()
  async check() {
    const started = Date.now();
    const checks: Record<string, { ok: boolean; info?: any; latencyMs?: number }> = {};

    // DB probe
    const t0 = Date.now();
    try {
      await this.ds.query('SELECT 1');
      checks.database = { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      checks.database = { ok: false, info: err?.message, latencyMs: Date.now() - t0 };
    }

    // AI probe (non-blocking: just config)
    checks.ai_coach = {
      ok: this.coach.isAvailable(),
      info: { model: this.coach.getModelName() },
    };
    checks.ai_reasoning = {
      ok: this.reasoning.isEnabled(),
      info: this.reasoning.getRateStatus(),
    };

    // Active feed provider
    const active = this.orchestrator.getActiveProviderName();
    checks.active_feed = { ok: true, info: { provider: active } };

    const allOk = Object.values(checks).every((c) => c.ok);
    return {
      status: allOk ? 'ok' : 'degraded',
      uptime_s: Math.round((Date.now() - this.startedAt) / 1000),
      checked_at_utc: new Date().toISOString(),
      response_time_ms: Date.now() - started,
      checks,
    };
  }
}
