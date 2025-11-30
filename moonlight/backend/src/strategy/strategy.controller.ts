import { Controller, Get } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyDefinitionDTO } from '../shared/dto/strategy-definition.dto';

@Controller('strategy')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get('list')
  async listStrategies(): Promise<StrategyDefinitionDTO[]> {
    return this.strategyService.getStrategyDefinitions();
  }
}
