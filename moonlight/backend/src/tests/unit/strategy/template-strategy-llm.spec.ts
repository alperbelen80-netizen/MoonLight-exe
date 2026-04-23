import { TemplateStrategyBuilderService } from '../../../strategy/factory/template-strategy-builder.service';
import { IndicatorRegistryService } from '../../../indicators/indicator-registry.service';
import { StrategyFactoryService } from '../../../strategy/factory/strategy-factory.service';
import { IndicatorService } from '../../../strategy/indicators/indicator.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';

function makeCoach(available: boolean, response?: string, shouldThrow = false): AICoachService {
  return {
    isAvailable: () => available,
    chat: jest.fn().mockImplementation(() => {
      if (shouldThrow) return Promise.reject(new Error('llm down'));
      return Promise.resolve(response ?? '{"direction":"LONG","confidence":0.8,"rationale":"ok"}');
    }),
    getModelName: () => 'gemini-2.5-flash',
  } as unknown as AICoachService;
}

function makeBars(n = 40) {
  const bars = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    price += (Math.random() - 0.5) * 2;
    bars.push({
      timestamp: new Date(Date.now() - (n - i) * 60000),
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 1000,
    });
  }
  return bars;
}

describe('TemplateStrategyBuilder · V2.3-A LLM augmentation', () => {
  const origFlag = process.env.MOE_TEMPLATE_LLM_ENABLED;

  afterEach(() => {
    if (origFlag === undefined) delete process.env.MOE_TEMPLATE_LLM_ENABLED;
    else process.env.MOE_TEMPLATE_LLM_ENABLED = origFlag;
  });

  function buildSvc(coach?: AICoachService): TemplateStrategyBuilderService {
    const registry = new IndicatorRegistryService();
    const ind = new IndicatorService();
    const factory = new StrategyFactoryService(ind);
    return new TemplateStrategyBuilderService(registry, factory, ind, coach);
  }

  function findDormantId(svc: TemplateStrategyBuilderService): string | null {
    // Introspect factory via (svc as any).factory
    const factory = (svc as unknown as { factory: StrategyFactoryService }).factory;
    for (const def of factory.getAllDefinitions()) {
      if (def.id.startsWith('tpl_') && (def.category as string) === 'dormant') return def.id;
    }
    return null;
  }

  it('dormant template stays silent when LLM is disabled', async () => {
    delete process.env.MOE_TEMPLATE_LLM_ENABLED;
    const svc = buildSvc(makeCoach(true));
    svc.registerAll();
    const stats = svc.stats();
    expect(stats.llmEnabled).toBe(false);
    expect(stats.llmAugmented).toBe(0);
  });

  it('LLM flag activates but coach unavailable → still silent', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const svc = buildSvc(makeCoach(false));
    svc.registerAll();
    expect(svc.stats().llmEnabled).toBe(false);
  });

  it('LLM-enabled build: llmAugmented count > 0 when coach available', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const svc = buildSvc(makeCoach(true));
    const r = svc.registerAll();
    expect(r.llmAugmented).toBeGreaterThan(0);
    expect(svc.stats().llmEnabled).toBe(true);
  });

  it('LLM-enabled: garbage response → no signal emitted', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const coach = makeCoach(true, 'not valid json');
    const svc = buildSvc(coach);
    svc.registerAll();
    const id = findDormantId(svc);
    if (!id) return; // no dormant templates
    const factory = (svc as unknown as { factory: StrategyFactoryService }).factory;
    const s = factory.getStrategy(id)!;
    const res = await s.evaluate({ bars: makeBars(), symbol: 'EURUSD', tf: '15m' } as never);
    expect(res).toBeNull();
  });

  it('LLM-enabled: coach throws → no signal emitted (fail-closed)', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const coach = makeCoach(true, undefined, true);
    const svc = buildSvc(coach);
    svc.registerAll();
    const id = findDormantId(svc);
    if (!id) return;
    const factory = (svc as unknown as { factory: StrategyFactoryService }).factory;
    const s = factory.getStrategy(id)!;
    const res = await s.evaluate({ bars: makeBars(), symbol: 'EURUSD', tf: '15m' } as never);
    expect(res).toBeNull();
  });

  it('LLM-enabled: low-confidence LLM response → no signal emitted', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const coach = makeCoach(true, '{"direction":"LONG","confidence":0.3}');
    const svc = buildSvc(coach);
    svc.registerAll();
    const id = findDormantId(svc);
    if (!id) return;
    const factory = (svc as unknown as { factory: StrategyFactoryService }).factory;
    const s = factory.getStrategy(id)!;
    const res = await s.evaluate({ bars: makeBars(), symbol: 'EURUSD', tf: '15m' } as never);
    expect(res).toBeNull();
  });

  it('LLM-enabled: high-confidence LONG response → emits signal with LLM source', async () => {
    process.env.MOE_TEMPLATE_LLM_ENABLED = 'true';
    const coach = makeCoach(true, '{"direction":"LONG","confidence":0.82,"rationale":"pattern"}');
    const svc = buildSvc(coach);
    svc.registerAll();
    const id = findDormantId(svc);
    if (!id) return;
    const factory = (svc as unknown as { factory: StrategyFactoryService }).factory;
    const s = factory.getStrategy(id)!;
    const res = (await s.evaluate({ bars: makeBars(), symbol: 'EURUSD', tf: '15m' } as never)) as { source: string; direction: string } | null;
    expect(res).not.toBeNull();
    expect(res!.source).toBe('TEMPLATE_STRATEGY_LLM');
    expect(res!.direction).toBe('LONG');
  });
});
