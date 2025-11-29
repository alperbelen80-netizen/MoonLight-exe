import { Test, TestingModule } from '@nestjs/testing';
import { PresetLoaderService } from '../../../strategy/preset/preset-loader.service';
import { StrategyFactoryService } from '../../../strategy/factory/strategy-factory.service';
import { IndicatorService } from '../../../strategy/indicators/indicator.service';

describe('PresetLoaderService', () => {
  let service: PresetLoaderService;
  let factory: StrategyFactoryService;
  let indicatorService: IndicatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PresetLoaderService, StrategyFactoryService, IndicatorService],
    }).compile();

    service = module.get<PresetLoaderService>(PresetLoaderService);
    factory = module.get<StrategyFactoryService>(StrategyFactoryService);
    indicatorService = module.get<IndicatorService>(IndicatorService);
  });

  it('should load all presets from YAML files', async () => {
    const presets = await service.loadAllPresets();

    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets.some((p) => p.id === 'bb_rsi_squeeze_long_1m')).toBe(true);
    expect(presets.some((p) => p.id === 'bb_rsi_squeeze_short_1m')).toBe(true);
    expect(presets.some((p) => p.id === 'rsi_mean_revert_1m')).toBe(true);
    expect(presets.some((p) => p.id === 'ema_trend_follow_15m')).toBe(true);
  });

  it('should get preset by id', async () => {
    const preset = await service.getPresetById('bb_rsi_squeeze_long_1m');

    expect(preset).toBeDefined();
    expect(preset!.name).toContain('BB + RSI');
    expect(preset!.category).toBe('scalping');
  });

  it('should return undefined for non-existent preset id', async () => {
    const preset = await service.getPresetById('non_existent_preset');

    expect(preset).toBeUndefined();
  });

  it('should register presets into factory', async () => {
    await factory.onModuleInit();

    const before = factory.getAllDefinitions().length;

    await service.registerPresetsIntoFactory(factory, indicatorService);

    const after = factory.getAllDefinitions().length;

    expect(after).toBeGreaterThan(before);
  });
});
