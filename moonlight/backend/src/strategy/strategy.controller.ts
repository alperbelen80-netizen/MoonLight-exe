import { Controller, Get, Post, Param } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { LiveStrategyPerformanceService, StrategyPerformanceDTO } from './live-strategy-performance.service';
import { StrategyDefinitionDTO } from '../shared/dto/strategy-definition.dto';

@Controller('strategy')
export class StrategyController {
  constructor(
    private readonly strategyService: StrategyService,
    private readonly performanceService: LiveStrategyPerformanceService,
  ) {}

  @Get('list')
  async listStrategies(): Promise<StrategyDefinitionDTO[]> {
    return this.strategyService.getStrategyDefinitions();
  }

  @Get('performance')
  async getPerformance(): Promise<StrategyPerformanceDTO[]> {
    return this.performanceService.getAllPerformance();
  }

  @Post(':id/enable')
  async enableStrategy(@Param('id') id: string) {
    await this.performanceService.enableStrategy(id);
    return { status: 'OK', strategy_id: id, enabled: true };
  }

  @Post(':id/disable')
  async disableStrategy(@Param('id') id: string) {
    await this.performanceService.disableStrategy(id);
    return { status: 'OK', strategy_id: id, enabled: false };
  }
}
