import { IndicatorRegistryService } from '../../../indicators/indicator-registry.service';

describe('IndicatorRegistryService', () => {
  let svc: IndicatorRegistryService;

  beforeAll(() => {
    svc = new IndicatorRegistryService();
  });

  it('loads exactly 100 indicators and 100 templates', () => {
    expect(svc.listIndicators().length).toBe(100);
    expect(svc.listTemplates().length).toBe(100);
  });

  it('every indicator has id + numeric n 1..100', () => {
    const inds = svc.listIndicators();
    const ns = new Set(inds.map((i) => i.n));
    for (let i = 1; i <= 100; i++) expect(ns.has(i)).toBe(true);
    for (const ind of inds) {
      expect(ind.id).toMatch(/^ind_\d{3}_/);
      expect(typeof ind.name).toBe('string');
      expect(ind.name.length).toBeGreaterThan(0);
    }
  });

  it('getIndicator accepts both numeric n and id', () => {
    const byNum = svc.getIndicator(1);
    expect(byNum).not.toBeNull();
    const byId = svc.getIndicator(byNum!.id);
    expect(byId).not.toBeNull();
    expect(byId!.n).toBe(1);
  });

  it('returns null for unknown ids', () => {
    expect(svc.getIndicator('ind_999_fake')).toBeNull();
    expect(svc.getIndicator(9999)).toBeNull();
  });

  it('searchIndicators filters by family (case-insensitive)', () => {
    const trends = svc.searchIndicators({ family: 'Trend' });
    expect(trends.length).toBeGreaterThan(5);
    for (const t of trends) {
      expect(t.family.toLowerCase()).toContain('trend');
    }
  });

  it('searchIndicators filters by text', () => {
    const ema = svc.searchIndicators({ textLike: 'EMA' });
    expect(ema.length).toBeGreaterThan(0);
  });

  it('stats() includes family counts and totals', () => {
    const s = svc.stats();
    expect(s.totalIndicators).toBe(100);
    expect(s.totalTemplates).toBe(100);
    expect(Object.keys(s.familyCounts).length).toBeGreaterThan(0);
  });

  it('every template has a long/short rule', () => {
    for (const t of svc.listTemplates()) {
      expect(typeof t.longRule).toBe('string');
      expect(typeof t.shortRule).toBe('string');
    }
  });
});
