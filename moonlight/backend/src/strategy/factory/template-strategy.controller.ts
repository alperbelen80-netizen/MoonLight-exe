import { Controller, Get, Post } from '@nestjs/common';
import { TemplateStrategyBuilderService } from './template-strategy-builder.service';
import { StrategyFactoryService } from './strategy-factory.service';

@Controller('strategy')
export class TemplateStrategyController {
  constructor(
    private readonly builder: TemplateStrategyBuilderService,
    private readonly factory: StrategyFactoryService,
  ) {}

  @Get('templates/stats')
  stats() {
    return {
      ...this.builder.stats(),
      registeredTotal: this.factory.getAllDefinitions().length,
    };
  }

  @Post('templates/register-all')
  registerAll() {
    return this.builder.registerAll();
  }
}
