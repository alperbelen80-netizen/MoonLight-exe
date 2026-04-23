import { CEOBrainService } from '../../../moe-brain/brains/ceo-brain.service';
import { TRADEBrainService } from '../../../moe-brain/brains/trade-brain.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';
import { ExpertVote, BrainType, ExpertRole } from '../../../moe-brain/shared/moe.enums';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';

describe('CEOBrainService / TRADEBrainService — fallback path (LLM unavailable)', () => {
  function makeCoach(available: boolean) {
    const coach = Object.assign(Object.create(AICoachService.prototype), {
      isAvailable: () => available,
      chat: jest.fn(),
      getModelName: () => 'gemini-2.5-flash',
    }) as AICoachService;
    return coach;
  }

  // Minimal stub learner returning default priors for the requested brain.
  function makeLearner(): ClosedLoopLearnerService {
    const defaults: Record<BrainType, Partial<Record<ExpertRole, number>>> = {
      [BrainType.CEO]: {
        [ExpertRole.TREND]: 0.6,
        [ExpertRole.MEAN_REVERSION]: 0.2,
        [ExpertRole.VOLATILITY]: 0.5,
        [ExpertRole.NEWS]: 0.3,
        [ExpertRole.MACRO]: 0.3,
      },
      [BrainType.TRADE]: {
        [ExpertRole.ENTRY]: 0.5,
        [ExpertRole.EXIT]: 0.3,
        [ExpertRole.SLIPPAGE]: 0.4,
        [ExpertRole.PAYOUT]: 0.7,
        [ExpertRole.SESSION]: 0.3,
      },
      [BrainType.TEST]: {
        [ExpertRole.OVERFIT_HUNTER]: 0.8,
        [ExpertRole.DATA_LEAK_DETECTOR]: 0.9,
        [ExpertRole.BIAS_AUDITOR]: 0.5,
        [ExpertRole.ADVERSARIAL_ATTACKER]: 0.6,
        [ExpertRole.ROBUSTNESS_TESTER]: 0.5,
      },
    };
    return {
      getPriors: (brain: BrainType) => ({ ...defaults[brain] }),
    } as unknown as ClosedLoopLearnerService;
  }

  const bullishCtx = {
    signalId: 's1',
    symbol: 'EURUSD',
    timeframe: '15m',
    direction: 'LONG' as const,
    timestampUtc: new Date().toISOString(),
    adx: 30,
    emaSlope: 0.5,
    rsi: 22,
    atrPct: 1.5,
    payoutPct: 86,
    expectedSlippageBps: 3,
    sessionUtcHour: 14,
    confidenceScore: 0.75,
  };

  const bearishVetoCtx = {
    signalId: 's2',
    symbol: 'BTCUSDT',
    timeframe: '5m',
    direction: 'LONG' as const,
    timestampUtc: new Date().toISOString(),
    atrPct: 9, // extreme vol
    payoutPct: 60, // low payout
    sessionUtcHour: 2,
    confidenceScore: 0.3,
  };

  it('CEO falls back to deterministic when coach is unavailable and APPROVES a bullish ctx', async () => {
    const svc = new CEOBrainService(makeCoach(false), makeLearner());
    const out = await svc.evaluate(bullishCtx);
    expect(out.brain).toBe('CEO');
    expect(out.experts.length).toBe(5);
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
  });

  it('CEO veto triggers on extreme volatility', async () => {
    const svc = new CEOBrainService(makeCoach(false), makeLearner());
    const out = await svc.evaluate(bearishVetoCtx);
    expect(out.vetoFlag).toBe(true);
  });

  it('TRADE falls back to deterministic and APPROVES a high-payout bullish ctx', async () => {
    const svc = new TRADEBrainService(makeCoach(false), makeLearner());
    const out = await svc.evaluate(bullishCtx);
    expect(out.brain).toBe('TRADE');
    expect(out.experts.length).toBe(5);
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
  });

  it('TRADE vetoes on low payout (binary-aware)', async () => {
    const svc = new TRADEBrainService(makeCoach(false), makeLearner());
    const out = await svc.evaluate(bearishVetoCtx);
    expect(out.vetoFlag).toBe(true);
  });

  it('CEO uses LLM response when coach is available and parse succeeds', async () => {
    const coach = makeCoach(true);
    (coach.chat as jest.Mock).mockResolvedValue(
      JSON.stringify({
        experts: [
          { role: 'TREND', vote: 'APPROVE', confidence: 0.9, rationale: 'r', reasonCodes: ['LLM_OK'] },
          { role: 'MEAN_REVERSION', vote: 'NEUTRAL', confidence: 0.3, rationale: 'r', reasonCodes: [] },
          { role: 'VOLATILITY', vote: 'APPROVE', confidence: 0.7, rationale: 'r', reasonCodes: [] },
          { role: 'NEWS', vote: 'APPROVE', confidence: 0.5, rationale: 'r', reasonCodes: [] },
          { role: 'MACRO', vote: 'APPROVE', confidence: 0.6, rationale: 'r', reasonCodes: [] },
        ],
      }),
    );
    const svc = new CEOBrainService(coach, makeLearner());
    const out = await svc.evaluate(bullishCtx);
    const trend = out.experts.find((e) => e.role === 'TREND')!;
    expect(trend.reasonCodes).toContain('LLM_OK');
    expect(out.aggregate.vote).toBe(ExpertVote.APPROVE);
  });

  it('CEO falls back when LLM returns garbage', async () => {
    const coach = makeCoach(true);
    (coach.chat as jest.Mock).mockResolvedValue('not json at all');
    const svc = new CEOBrainService(coach, makeLearner());
    const out = await svc.evaluate(bullishCtx);
    // Still produces 5 experts (all deterministic)
    expect(out.experts.length).toBe(5);
  });

  it('CEO falls back when LLM call throws', async () => {
    const coach = makeCoach(true);
    (coach.chat as jest.Mock).mockRejectedValue(new Error('gateway down'));
    const svc = new CEOBrainService(coach, makeLearner());
    const out = await svc.evaluate(bullishCtx);
    expect(out.experts.length).toBe(5);
  });
});
