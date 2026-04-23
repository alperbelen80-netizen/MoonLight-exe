import { Module } from '@nestjs/common';
import { IndicatorRegistryService } from './indicator-registry.service';
import { IndicatorRegistryController } from './indicator-registry.controller';

@Module({
  providers: [IndicatorRegistryService],
  controllers: [IndicatorRegistryController],
  exports: [IndicatorRegistryService],
})
export class IndicatorRegistryModule {}
