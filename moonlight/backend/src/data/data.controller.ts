import { Controller, Get } from '@nestjs/common';
import { DataFeedOrchestrator } from './sources/data-feed-orchestrator.service';

@Controller('data')
export class DataController {
  constructor(
    private readonly dataFeedOrchestrator: DataFeedOrchestrator,
  ) {}

  @Get('providers')
  async getProviders() {
    const providers = await this.dataFeedOrchestrator.getAvailableProviders();
    const active = this.dataFeedOrchestrator.getActiveProviderName();

    return {
      active,
      providers,
    };
  }
}
