import { Body, Controller, Get, Post } from '@nestjs/common';
import { AICoachService } from './ai-coach.service';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';

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

@Controller('ai-coach')
export class AICoachController {
  constructor(
    private readonly coach: AICoachService,
    private readonly orchestrator: DataFeedOrchestrator,
  ) {}

  @Get('status')
  getStatus() {
    return {
      available: this.coach.isAvailable(),
      model: this.coach.getModelName(),
      provider: 'emergent-llm-gateway',
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
}
