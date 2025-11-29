import { Test, TestingModule } from '@nestjs/testing';
import { StrategyFactoryService, StrategyInstance } from '../../../strategy/factory/strategy-factory.service';
import { IndicatorService } from '../../../strategy/indicators/indicator.service';
import { StrategyDefinitionDTO } from '../../../shared/dto/strategy-definition.dto';

describe('StrategyFactoryService', () => {
  let factory: StrategyFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StrategyFactoryService, IndicatorService],
    }).compile();

    factory = module.get<StrategyFactoryService>(StrategyFactoryService);
    await factory.onModuleInit();
  });

  it('should register built-in strategies on init', () => {
    const definitions = factory.getAllDefinitions();

    expect(definitions.length).toBeGreaterThanOrEqual(2);
    expect(definitions.some((d) => d.id === 'bb_rsi_buy_v1')).toBe(true);
    expect(definitions.some((d) => d.id === 'bb_rsi_sell_v1')).toBe(true);
  });

  it('should get strategy by id', () => {
    const strategy = factory.getStrategy('bb_rsi_buy_v1');

    expect(strategy).toBeDefined();
    expect(strategy!.id).toBe('bb_rsi_buy_v1');
    expect(strategy!.definition.name).toContain('BB + RSI');
  });

  it('should return undefined for non-existent strategy', () => {
    const strategy = factory.getStrategy('non_existent_strategy');

    expect(strategy).toBeUndefined();
  });

  it('should get all active strategies', () => {
    const active = factory.getActiveStrategies();

    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  it('should allow re-registering strategy (overwrite)', () => {
    const dummyStrategy: StrategyInstance = {
      id: 'bb_rsi_buy_v1',
      definition: {
        id: 'bb_rsi_buy_v1',
        name: 'Overwritten',
        category: 'scalping',
        version: 2,
        parameters: [] as any,
        allowed_timeframes: [] as any,
      },
      evaluate: async (): Promise<null> => null,
    };

    factory.registerStrategy(dummyStrategy);

    const retrieved = factory.getStrategy('bb_rsi_buy_v1');
    expect(retrieved!.definition.name).toBe('Overwritten');
  });
});
