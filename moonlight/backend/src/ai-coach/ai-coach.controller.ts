import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AICoachService } from './ai-coach.service';
import { AIReasoningService } from './ai-reasoning.service';
import { AIInsightsService } from './ai-insights.service';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';
import { LiveSignal } from '../database/entities/live-signal.entity';

interface ChatPayload {
  message: string;
  context?: Record<string, any>;
}

interface AnalyzeStrategyPayload {
  strategyId: string;
  totalSignals?: number;
  executedSignals?: number;
  winRate?: number;
  avgPnl?: number;
  avgConfidence?: number;
  consecutiveLosses?: number;
  regime?: string;
}

interface TuneStrategyPayload {
  strategyId: string;
}

@Controller('ai-coach')
export class AICoachController {
  constructor(
    private readonly coach: AICoachService,
    private readonly reasoning: AIReasoningService,
    private readonly insights: AIInsightsService,
    private readonly orchestrator: DataFeedOrchestrator,
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
  ) {}

  @Get('status')
  getStatus() {
    const rate = this.reasoning.getRateStatus();
    return {
      available: this.coach.isAvailable(),
      model: this.coach.getModelName(),
      provider: 'emergent-llm-gateway',
      reasoning_enabled: this.reasoning.isEnabled(),
      strict_guard: this.reasoning.isStrictGuard(),
      rate_limit: rate,
    };
  }

  @Post('chat')
  async chat(@Body() payload: ChatPayload) {
    const text = await this.coach.freeformCoaching(payload?.message || '', payload?.context);
    return { reply: text, model: this.coach.getModelName() };
  }

  @Post('analyze-strategy')
  async analyze(@Body() body: AnalyzeStrategyPayload) {
    const advice = await this.coach.analyzeStrategy({
      strategyId: body.strategyId,
      totalSignals: body.totalSignals ?? 0,
      executedSignals: body.executedSignals ?? 0,
      winRate: body.winRate ?? 0,
      avgPnl: body.avgPnl ?? 0,
      avgConfidence: body.avgConfidence ?? 0,
      consecutiveLosses: body.consecutiveLosses ?? 0,
      regime: body.regime,
    });
    return { advice, model: this.coach.getModelName() };
  }

  @Post('validate-feed')
  async validateFeed() {
    const health = await this.orchestrator.getProvidersHealth();
    const deterministic = this.orchestrator.selectBestProvider(health);
    const result = await this.coach.validateFeedSelection({
      providers: health,
      deterministicChoice: deterministic,
    });
    return { deterministic, ai: result, health };
  }

  // ---- Phase A: AI Reasoning endpoints ----
  // Static route MUST be declared BEFORE parameterised route so that
  // NestJS / Express underlying router matches '/reason-signal/batch'
  // as a literal path instead of treating 'batch' as an :id.
  @Post('reason-signal/batch')
  async reasonBatch(@Body() body: { limit?: number } = {}) {
    const limit = Math.max(1, Math.min(body?.limit ?? 10, 25));
    const results = await this.reasoning.reasonBatch(limit);
    return { processed: results.length, results };
  }

  @Post('reason-signal/:id')
  async reasonSignal(@Param('id') id: string) {
    const signal = await this.liveSignalRepo.findOne({ where: { id } });
    if (!signal) {
      return { error: 'signal_not_found', id };
    }
    const regimeMatch = /Regime:\s*([A-Z]+)/.exec(signal.notes || '');
    const adxMatch = /ADX:\s*([\d.]+)/.exec(signal.notes || '');
    const result = await this.reasoning.reasonAndPersist(id, {
      signalId: id,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      direction: signal.direction,
      strategy: signal.strategy_family,
      confidence: signal.confidence_score,
      regime: regimeMatch ? regimeMatch[1] : undefined,
      adx: adxMatch ? parseFloat(adxMatch[1]) : undefined,
      entryPrice: signal.entry_price,
      expectedEV: (signal.expected_wr_band_min + signal.expected_wr_band_max) / 2,
    });
    return { signalId: id, ...result };
  }

  @Get('reasoning-history')
  async reasoningHistory(
    @Query('verdict') verdict?: string,
    @Query('symbol') symbol?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.max(1, Math.min(parseInt(limitRaw || '50', 10), 200));
    const since = new Date(Date.now() - 24 * 3600_000);
    const where: any = { timestamp_utc: Between(since, new Date()) };
    if (verdict) where.ai_verdict = verdict.toUpperCase();
    if (symbol) where.symbol = symbol;

    const rows = await this.liveSignalRepo.find({
      where,
      order: { ai_reasoned_at_utc: 'DESC', timestamp_utc: 'DESC' },
      take: limit,
    });
    return {
      items: rows.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        timeframe: s.timeframe,
        direction: s.direction,
        confidence_score: s.confidence_score,
        ai_verdict: s.ai_verdict,
        ai_confidence: s.ai_confidence,
        ai_reasoning: s.ai_reasoning,
        ai_reasoned_at_utc: s.ai_reasoned_at_utc,
        timestamp_utc: s.timestamp_utc,
        strategy_family: s.strategy_family,
        notes: s.notes,
      })),
      count: rows.length,
    };
  }

  // ---- Phase B: Dashboard AI Insights ----

  @Get('daily-insights')
  async dailyInsights(@Query('window') windowHours?: string, @Query('force') force?: string) {
    const win = Math.max(1, Math.min(parseInt(windowHours || '24', 10), 168));
    const forceRefresh = force === '1' || force === 'true';
    return this.insights.getDailyInsights(win, forceRefresh);
  }

  // ---- Phase C: Market Intelligence ----

  @Get('regime-heatmap')
  async regimeHeatmap() {
    return this.insights.getRegimeHeatmap();
  }

  // ---- Phase D: Strategy Leaderboard + Tune ----

  @Get('strategy-leaderboard')
  async leaderboard() {
    return { items: await this.insights.getStrategyLeaderboard() };
  }

  @Post('tune-strategy')
  async tuneStrategy(@Body() body: TuneStrategyPayload) {
    const leaderboard = await this.insights.getStrategyLeaderboard();
    const entry = leaderboard.find((e) => e.strategy_family === body.strategyId);
    if (!entry) {
      return { error: 'strategy_not_found', strategyId: body.strategyId };
    }
    const advice = await this.coach.analyzeStrategy({
      strategyId: entry.strategy_family,
      totalSignals: entry.live_signal_count,
      executedSignals: entry.ai_approved_count,
      winRate: entry.ai_approval_rate,
      avgPnl: 0,
      avgConfidence: entry.avg_confidence,
      consecutiveLosses: 0,
    });
    return { strategyId: entry.strategy_family, stats: entry, advice, model: this.coach.getModelName() };
  }
}
