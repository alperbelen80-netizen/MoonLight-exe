import { Module, OnModuleInit } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyFactoryService } from './factory/strategy-factory.service';
import { IndicatorService } from './indicators/indicator.service';
import { PresetLoaderService } from './preset/preset-loader.service';
import { EVVetoSlotEngine } from './evvetoslot/evvetoslot-engine.service';
import { PackFactoryService } from './pack-factory/pack-factory.service';
import { GatingService } from './gating/gating.service';

@Module({
  providers: [
    StrategyService,
    StrategyFactoryService,
    IndicatorService,
    PresetLoaderService,
    EVVetoSlotEngine,
    PackFactoryService,
    GatingService,
  ],
  exports: [StrategyService, PresetLoaderService, IndicatorService],
})
export class StrategyModule implements OnModuleInit {
  constructor(
    private readonly presetLoader: PresetLoaderService,
    private readonly strategyFactory: StrategyFactoryService,
    private readonly indicatorService: IndicatorService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.presetLoader.registerPresetsIntoFactory(
      this.strategyFactory,
      this.indicatorService,
    );
  }
}
