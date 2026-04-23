import { TemplateStrategyBuilderService } from '../../../strategy/factory/template-strategy-builder.service';
import { IndicatorRegistryService } from '../../../indicators/indicator-registry.service';
import { StrategyFactoryService } from '../../../strategy/factory/strategy-factory.service';
import { IndicatorService } from '../../../strategy/indicators/indicator.service';

describe('TemplateStrategyBuilderService', () => {
  let registry: IndicatorRegistryService;
  let factory: StrategyFactoryService;
  let indicators: IndicatorService;
  let builder: TemplateStrategyBuilderService;

  beforeEach(() => {
    registry = new IndicatorRegistryService();
    indicators = new IndicatorService();
    factory = new StrategyFactoryService(indicators);
    builder = new TemplateStrategyBuilderService(registry, factory, indicators);
    // Avoid onModuleInit auto-load; call registerAll manually.
  });

  it('registers 100 strategies into factory on registerAll()', () => {
    const before = factory.getAllDefinitions().length;
    const r = builder.registerAll();
    expect(r.total).toBe(100);
    expect(factory.getAllDefinitions().length).toBe(before + 100);
    expect(r.implemented + r.dormant).toBe(100);
  });

  it('registered strategy ids follow tpl_NNN_v1 pattern', () => {
    builder.registerAll();
    const ids = factory.getAllDefinitions().map((d) => d.id).filter((id) => id.startsWith('tpl_'));
    expect(ids.length).toBe(100);
    for (const id of ids) expect(id).toMatch(/^tpl_\d{3}_v1$/);
  });

  it('dormant strategies never emit signals', async () => {
    builder.registerAll();
    const s = factory.getStrategy('tpl_100_v1');
    expect(s).toBeDefined();
    // Even with empty bars, must be null (no false positives).
    const res = await s!.evaluate({ bars: [], symbol: 'X', tf: '5m' } as never);
    expect(res).toBeNull();
  });

  it('stats reflect registerAll counts', () => {
    builder.registerAll();
    const s = builder.stats();
    expect(s.total).toBe(100);
    expect(s.implemented + s.dormant).toBe(100);
  });
});
