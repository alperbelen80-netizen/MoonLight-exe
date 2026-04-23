import { TESTBrainService } from '../../../moe-brain/brains/test-brain.service';
import { BrainType, ExpertRole, ExpertVote } from '../../../moe-brain/shared/moe.enums';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';

function makeLearner(): ClosedLoopLearnerService {
  return {
    getPriors: (_brain: BrainType) => ({
      [ExpertRole.OVERFIT_HUNTER]: 0.8,
      [ExpertRole.DATA_LEAK_DETECTOR]: 0.9,
      [ExpertRole.BIAS_AUDITOR]: 0.5,
      [ExpertRole.ADVERSARIAL_ATTACKER]: 0.6,
      [ExpertRole.ROBUSTNESS_TESTER]: 0.5,
    }),
  } as unknown as ClosedLoopLearnerService;
}

describe('TESTBrainService (deterministic red team)', () => {
  const svc = new TESTBrainService(makeLearner());

  function baseCtx(overrides: Record<string, unknown> = {}) {
    return {
      signalId: 's1',
      symbol: 'EURUSD',
      timeframe: '15m',
      direction: 'LONG' as const,
      timestampUtc: new Date().toISOString(),
      ...overrides,
    };
  }

  it('vetoes when sample size is too small', async () => {
    const out = await svc.evaluate(baseCtx({ sampleCount: 10 }));
    expect(out.vetoFlag).toBe(true);
    expect(out.aggregate.vote).toBe(ExpertVote.REJECT);
  });

  it('vetoes when feature leak suspicion is high', async () => {
    const out = await svc.evaluate(baseCtx({ featureLeakSuspicion: 0.9, sampleCount: 500 }));
    expect(out.vetoFlag).toBe(true);
  });

  it('approves a balanced profile', async () => {
    const out = await svc.evaluate(
      baseCtx({
        sampleCount: 500,
        backtestWinRate: 0.58,
        backtestMaxDrawdownPct: 12,
        featureLeakSuspicion: 0.05,
        atrPct: 1.2,
        payoutPct: 85,
        sessionUtcHour: 14,
        adx: 27,
        emaSlope: 0.3,
      }),
    );
    expect(out.vetoFlag).toBe(false);
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
  });

  it('vetoes on strong counter-trend', async () => {
    const out = await svc.evaluate(
      baseCtx({
        direction: 'SHORT',
        adx: 45,
        emaSlope: 1.0, // strong up-trend
        sampleCount: 400,
        backtestWinRate: 0.6,
        backtestMaxDrawdownPct: 10,
        featureLeakSuspicion: 0.05,
      }),
    );
    expect(out.vetoFlag).toBe(true);
  });

  it('vetoes suspiciously high win rate', async () => {
    const out = await svc.evaluate(
      baseCtx({ sampleCount: 500, backtestWinRate: 0.99, backtestMaxDrawdownPct: 0.1 }),
    );
    expect(out.vetoFlag).toBe(true);
    // At least one of OVERFIT_HUNTER / BIAS_AUDITOR should reject strongly.
  });

  it('all experts always emit reasonCodes', async () => {
    const out = await svc.evaluate(baseCtx());
    for (const e of out.experts) {
      expect(Array.isArray(e.reasonCodes)).toBe(true);
      expect(e.reasonCodes!.length).toBeGreaterThan(0);
    }
  });
});
