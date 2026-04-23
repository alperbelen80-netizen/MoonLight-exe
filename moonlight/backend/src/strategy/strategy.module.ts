import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { StrategyFactoryService } from './factory/strategy-factory.service';
import { IndicatorService } from './indicators/indicator.service';
import { PresetLoaderService } from './preset/preset-loader.service';
import { EVVetoSlotEngine } from './evvetoslot/evvetoslot-engine.service';
import { PackFactoryService } from './pack-factory/pack-factory.service';
import { GatingService } from './gating/gating.service';
import { LiveStrategyPerformance } from '../database/entities/live-strategy-performance.entity';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { LiveStrategyPerformanceService } from './live-strategy-performance.service';
import { PayoutMatrixService } from '../broker/payout/payout-matrix.service';

@Module({
  imports: [TypeOrmModule.forFeature([LiveStrategyPerformance, LiveSignal])],
  controllers: [StrategyController],
  providers: [
    StrategyService,
    StrategyFactoryService,
    IndicatorService,
    PresetLoaderService,
    EVVetoSlotEngine,
    PackFactoryService,
    GatingService,
    LiveStrategyPerformanceService,
    PayoutMatrixService,
  ],
  exports: [
    StrategyService,
    PresetLoaderService,
    IndicatorService,
    LiveStrategyPerformanceService,
    PayoutMatrixService,
    EVVetoSlotEngine,
    StrategyFactoryService,
    PackFactoryService,
    GatingService,
  ],
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
