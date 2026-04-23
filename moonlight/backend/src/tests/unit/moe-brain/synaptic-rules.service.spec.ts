import { SynapticRulesService } from '../../../moe-brain/synaptic/synaptic-rules.service';
import { SynapticRule } from '../../../moe-brain/shared/moe.enums';

describe('SynapticRulesService', () => {
  let svc: SynapticRulesService;
  beforeEach(() => {
    svc = new SynapticRulesService();
  });

  it('default config uses conservative guardrails', () => {
    const cfg = svc.getConfig();
    expect(cfg.learningRate).toBeCloseTo(0.05);
    expect(cfg.maxStep).toBeCloseTo(0.1);
    expect(cfg.minWeight).toBeGreaterThan(0);
    expect(cfg.maxWeight).toBeLessThan(1);
  });

  it('HEBBIAN strengthens when x,y co-activate positively', () => {
    const r = svc.apply(SynapticRule.HEBBIAN, 0.5, 1, 1);
    expect(r.after).toBeGreaterThan(0.5 * (1 - svc.getConfig().decay));
    expect(r.after).toBeLessThanOrEqual(svc.getConfig().maxWeight);
  });

  it('ANTI_HEBBIAN weakens when x,y co-activate positively', () => {
    const r = svc.apply(SynapticRule.ANTI_HEBBIAN, 0.5, 1, 1);
    expect(r.after).toBeLessThan(0.5);
  });

  it('HOMEOSTATIC drags toward target rate when actual > target', () => {
    // actual=1.0, target=0.5 → factor=0.5 → weight decreases
    const r = svc.apply(SynapticRule.HOMEOSTATIC, 0.5, 0, 0, 1.0);
    expect(r.after).toBeLessThan(0.5);
  });

  it('HOMEOSTATIC drags toward target rate when actual < target', () => {
    // actual=0.25, target=0.5 → factor=2 → weight increases (but maxStep caps)
    const r = svc.apply(SynapticRule.HOMEOSTATIC, 0.3, 0, 0, 0.25);
    expect(r.after).toBeGreaterThan(0.3 * (1 - svc.getConfig().decay));
  });

  it('SPIKE is silent below threshold', () => {
    const r = svc.apply(SynapticRule.SPIKE, 0.5, 0.3, 1);
    // delta should be near 0 (only decay)
    expect(Math.abs(r.delta + 0.5 * svc.getConfig().decay)).toBeLessThan(1e-5);
  });

  it('SPIKE fires above threshold', () => {
    const r = svc.apply(SynapticRule.SPIKE, 0.5, 0.9, 1);
    expect(r.after).toBeGreaterThan(0.5 * (1 - svc.getConfig().decay));
  });

  it('RESIDUAL pulls toward input identity', () => {
    const r = svc.apply(SynapticRule.RESIDUAL, 0.2, 0.9, 0);
    expect(r.after).toBeGreaterThan(0.2 * (1 - svc.getConfig().decay));
  });

  it('PLASTIC scales learning with novelty', () => {
    const low = svc.apply(SynapticRule.PLASTIC, 0.5, 1, 1); // novelty=0
    const high = svc.apply(SynapticRule.PLASTIC, 0.5, 1, -1); // novelty=2→1
    // High-novelty change magnitude should be >= low-novelty change magnitude
    expect(Math.abs(high.delta)).toBeGreaterThanOrEqual(Math.abs(low.delta));
  });

  it('hard clamps weight to [minWeight, maxWeight]', () => {
    svc.setConfig({ maxStep: 10 }); // allow huge deltas to test clamp
    const up = svc.apply(SynapticRule.HEBBIAN, 0.95, 1, 1);
    expect(up.after).toBeLessThanOrEqual(svc.getConfig().maxWeight);
    expect(up.clamped).toBe(true);

    const dn = svc.apply(SynapticRule.ANTI_HEBBIAN, 0.05, 1, 1);
    expect(dn.after).toBeGreaterThanOrEqual(svc.getConfig().minWeight);
    expect(dn.clamped).toBe(true);
  });

  it('setConfig updates and is returned', () => {
    const out = svc.setConfig({ learningRate: 0.2 });
    expect(out.learningRate).toBeCloseTo(0.2);
  });

  it('applyBatch only touches keys present in weights', () => {
    const weights = { a: 0.5, b: 0.3 };
    const signals = {
      a: { x: 1, y: 1 },
      b: { x: 1, y: 1 },
      c: { x: 1, y: 1 },
    };
    const out = svc.applyBatch(SynapticRule.HEBBIAN, weights, signals);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });
});
