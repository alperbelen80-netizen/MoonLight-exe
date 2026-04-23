import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AICoachService } from './ai-coach.service';
import { AIReasoningService } from './ai-reasoning.service';
import { AIInsightsService } from './ai-insights.service';
import { BacktestAIAnalyzerService } from './backtest-ai-analyzer.service';
import { AICoachController } from './ai-coach.controller';
import { DataProvidersController } from '../data/data-providers.controller';
import { DataModule } from '../data/data.module';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { LiveStrategyPerformance } from '../database/entities/live-strategy-performance.entity';

@Module({
  imports: [
    DataModule,
    TypeOrmModule.forFeature([LiveSignal, LiveStrategyPerformance]),
  ],
  controllers: [AICoachController, DataProvidersController],
  providers: [AICoachService, AIReasoningService, AIInsightsService, BacktestAIAnalyzerService],
  exports: [AICoachService, AIReasoningService, AIInsightsService, BacktestAIAnalyzerService],
})
export class AICoachModule {}
