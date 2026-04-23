import { RiskProfileController } from '../../../risk/risk-profile.controller';

describe('RiskProfileController', () => {
  let controller: RiskProfileController;

  beforeEach(() => {
    controller = new RiskProfileController();
  });

  it('lists 3 built-in presets', () => {
    const r = controller.listPresets();
    const ids = r.presets.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['conservative', 'moderate', 'aggressive']));
    expect(r.presets).toHaveLength(3);
  });

  it('returns a current profile', () => {
    const r = controller.get();
    expect(r.current).toBeDefined();
    expect(r.current.r_per_trade_pct).toBeGreaterThan(0);
  });

  it('switches to a preset profile', () => {
    const r = controller.set({ id: 'conservative' });
    expect(r.current.id).toBe('conservative');
    expect(r.current.require_ai_approval).toBe(true);
  });

  it('accepts custom profile with clamping', () => {
    const r = controller.set({
      id: 'custom',
      label: 'My Custom',
      r_per_trade_pct: 15, // clamped to 10
      max_concurrent: 100, // clamped to 20
      max_daily_loss_pct: 50, // clamped to 25
      confidence_floor: 2, // clamped to 1
      require_ai_approval: true,
    });
    expect(r.current.id).toBe('custom');
    expect(r.current.r_per_trade_pct).toBe(10);
    expect(r.current.max_concurrent).toBe(20);
    expect(r.current.max_daily_loss_pct).toBe(25);
    expect(r.current.confidence_floor).toBe(1);
  });

  it('throws on unknown preset id', () => {
    expect(() => controller.set({ id: 'nope' as any })).toThrow();
  });
});
