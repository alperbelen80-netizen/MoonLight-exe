import { aggregate, softmax } from '../../../moe-brain/gating/softmax-gating';
import { BrainType, ExpertRole, ExpertVote } from '../../../moe-brain/shared/moe.enums';
import { ExpertOutput } from '../../../moe-brain/shared/moe.contracts';

describe('softmax()', () => {
  it('produces a valid probability distribution', () => {
    const d = softmax({ a: 1, b: 2, c: 3 });
    const sum = Object.values(d).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(d.c).toBeGreaterThan(d.b);
    expect(d.b).toBeGreaterThan(d.a);
  });

  it('returns {} on empty input', () => {
    expect(softmax({})).toEqual({});
  });
});

describe('aggregate()', () => {
  const priors: Partial<Record<ExpertRole, number>> = {
    [ExpertRole.TREND]: 0.6,
    [ExpertRole.VOLATILITY]: 0.4,
  };

  function expert(role: ExpertRole, vote: ExpertVote, conf: number): ExpertOutput {
    return { role, vote, confidence: conf, reasonCodes: [] };
  }

  it('APPROVE dominates when all experts approve with high confidence', () => {
    const out = aggregate(BrainType.CEO, [
      expert(ExpertRole.TREND, ExpertVote.APPROVE, 0.8),
      expert(ExpertRole.VOLATILITY, ExpertVote.APPROVE, 0.7),
    ], priors);
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
    expect(out.aggregate.confidence).toBeGreaterThan(0.5);
  });

  it('REJECT dominates when all experts reject', () => {
    const out = aggregate(BrainType.CEO, [
      expert(ExpertRole.TREND, ExpertVote.REJECT, 0.9),
      expert(ExpertRole.VOLATILITY, ExpertVote.REJECT, 0.8),
    ], priors);
    expect(out.aggregate.vote).toBe(ExpertVote.REJECT);
  });

  it('NEUTRAL falls in the dead band', () => {
    const out = aggregate(BrainType.CEO, [
      expert(ExpertRole.TREND, ExpertVote.APPROVE, 0.3),
      expert(ExpertRole.VOLATILITY, ExpertVote.REJECT, 0.3),
    ], priors);
    expect(out.aggregate.vote).toBe(ExpertVote.NEUTRAL);
  });

  it('triggers vetoFlag when a trigger role rejects with high confidence', () => {
    const out = aggregate(
      BrainType.CEO,
      [
        expert(ExpertRole.TREND, ExpertVote.APPROVE, 0.6),
        expert(ExpertRole.VOLATILITY, ExpertVote.REJECT, 0.8),
      ],
      priors,
      { vetoTriggerRoles: [ExpertRole.VOLATILITY] },
    );
    expect(out.vetoFlag).toBe(true);
  });

  it('skips errored experts from contribution', () => {
    const out = aggregate(
      BrainType.CEO,
      [
        { role: ExpertRole.TREND, vote: ExpertVote.APPROVE, confidence: 0.8, reasonCodes: [] },
        { role: ExpertRole.VOLATILITY, vote: ExpertVote.APPROVE, confidence: 0.9, reasonCodes: [], error: 'boom' },
      ],
      priors,
    );
    // Only TREND counted
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
  });

  it('returns weights that sum to ~1', () => {
    const out = aggregate(BrainType.CEO, [
      expert(ExpertRole.TREND, ExpertVote.NEUTRAL, 0.5),
      expert(ExpertRole.VOLATILITY, ExpertVote.NEUTRAL, 0.5),
    ], priors);
    const sum = Object.values(out.aggregate.weights).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) as number;
    expect(sum).toBeCloseTo(1, 5);
  });
});
