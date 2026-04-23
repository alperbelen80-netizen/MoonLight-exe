import { ABWeightingHarnessService } from '../../../moe-brain/learning/ab-weighting-harness.service';
import { MoEDecision } from '../../../moe-brain/shared/moe.enums';
import { EnsembleDecision } from '../../../moe-brain/shared/moe.contracts';

function mkDecision(overrides: Partial<EnsembleDecision> = {}): EnsembleDecision {
  return {
    decision: MoEDecision.ALLOW,
    confidence: 0.7,
    reasonCodes: [],
    brains: [],
    finalWeights: { ceo: 0.4, trade: 0.4, test: 0.2 },
    timestampUtc: new Date().toISOString(),
    ...overrides,
  };
}

describe('ABWeightingHarnessService', () => {
  let svc: ABWeightingHarnessService;
  beforeEach(() => {
    svc = new ABWeightingHarnessService();
  });

  it('starts empty', () => {
    const b = svc.buckets();
    expect(b.length).toBe(2);
    for (const x of b) expect(x.count).toBe(0);
  });

  it('records into HEALTH_WEIGHTED and STATIC buckets separately', () => {
    svc.record(mkDecision({ decision: MoEDecision.ALLOW }), true);
    svc.record(mkDecision({ decision: MoEDecision.VETO }), true);
    svc.record(mkDecision({ decision: MoEDecision.SKIP }), false);
    const b = svc.buckets();
    const hw = b.find((x) => x.mode === 'HEALTH_WEIGHTED')!;
    const st = b.find((x) => x.mode === 'STATIC')!;
    expect(hw.count).toBe(2);
    expect(hw.allow).toBe(1);
    expect(hw.veto).toBe(1);
    expect(st.count).toBe(1);
    expect(st.skip).toBe(1);
  });

  it('computes avgConfidence and avgWeights correctly', () => {
    svc.record(mkDecision({ confidence: 0.4, finalWeights: { ceo: 0.5, trade: 0.3, test: 0.2 } }), true);
    svc.record(mkDecision({ confidence: 0.8, finalWeights: { ceo: 0.3, trade: 0.5, test: 0.2 } }), true);
    const hw = svc.buckets().find((x) => x.mode === 'HEALTH_WEIGHTED')!;
    expect(hw.avgConfidence).toBeCloseTo(0.6, 2);
    expect(hw.avgWeights.ceo).toBeCloseTo(0.4, 2);
    expect(hw.avgWeights.trade).toBeCloseTo(0.4, 2);
  });

  it('caps samples at 500 (ring buffer)', () => {
    for (let i = 0; i < 600; i++) {
      svc.record(mkDecision(), i % 2 === 0);
    }
    const total = svc.buckets().reduce((a, b) => a + b.count, 0);
    expect(total).toBe(500);
  });

  it('recent(n) returns the most recent N', () => {
    for (let i = 0; i < 20; i++) svc.record(mkDecision({ confidence: i / 20 }), true);
    const r = svc.recent(5);
    expect(r.length).toBe(5);
    expect(r[r.length - 1].confidence).toBeCloseTo(19 / 20, 3);
  });

  it('clear() resets all samples', () => {
    svc.record(mkDecision(), true);
    svc.clear();
    expect(svc.buckets().every((b) => b.count === 0)).toBe(true);
  });
});
