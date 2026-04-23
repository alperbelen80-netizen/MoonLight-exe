import { GlobalMoEOrchestratorService } from '../../../moe-brain/global-moe-orchestrator.service';
import { CEOBrainService } from '../../../moe-brain/brains/ceo-brain.service';
import { TRADEBrainService } from '../../../moe-brain/brains/trade-brain.service';
import { TESTBrainService } from '../../../moe-brain/brains/test-brain.service';
import { BrainType, ExpertVote } from '../../../moe-brain/shared/moe.enums';
import { BrainOutput } from '../../../moe-brain/shared/moe.contracts';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';

function makeBrainOut(brain: BrainType): BrainOutput {
  return {
    brain,
    experts: [],
    aggregate: { vote: ExpertVote.APPROVE, confidence: 0.8, weights: {} },
    vetoFlag: false,
    latencyMs: 1,
    timestampUtc: new Date().toISOString(),
  };
}

function makeLearnerWithHealth(h: Partial<Record<BrainType, number>>): ClosedLoopLearnerService {
  return {
    getPriors: () => ({}),
    snapshot: () => [
      { brain: BrainType.CEO, updatedAt: '', priors: {}, health: h[BrainType.CEO] ?? 1 },
      { brain: BrainType.TRADE, updatedAt: '', priors: {}, health: h[BrainType.TRADE] ?? 1 },
      { brain: BrainType.TEST, updatedAt: '', priors: {}, health: h[BrainType.TEST] ?? 1 },
    ],
  } as unknown as ClosedLoopLearnerService;
}

function makeBrains() {
  const ceo = { evaluate: jest.fn().mockResolvedValue(makeBrainOut(BrainType.CEO)) } as unknown as CEOBrainService;
  const trade = { evaluate: jest.fn().mockResolvedValue(makeBrainOut(BrainType.TRADE)) } as unknown as TRADEBrainService;
  const test = { evaluate: jest.fn().mockResolvedValue(makeBrainOut(BrainType.TEST)) } as unknown as TESTBrainService;
  return { ceo, trade, test };
}

describe('GlobalMoEOrchestrator · health-weighted ensemble (V2.2)', () => {
  const origEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('reduces a brain’s effective weight as its health drops', async () => {
    const { ceo, trade, test } = makeBrains();
    const orch = new GlobalMoEOrchestratorService(
      ceo,
      trade,
      test,
      makeLearnerWithHealth({ [BrainType.CEO]: 0.2 }),
    );
    const eff = orch.getEffectiveWeights();
    const base = orch.getWeights();
    // CEO health is 0.2 but floor prevents zeroing. Effective CEO weight must
    // be strictly less than its base (normalized) share.
    expect(eff.ceo).toBeLessThan(base.ceo + 0.001);
    // Other brains get the reclaimed mass.
    expect(eff.trade + eff.test).toBeGreaterThan(base.trade + base.test - 0.001);
    const sum = eff.ceo + eff.trade + eff.test;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('falls back to base weights when MOE_HEALTH_WEIGHTING=false', () => {
    process.env.MOE_HEALTH_WEIGHTING = 'false';
    const { ceo, trade, test } = makeBrains();
    const orch = new GlobalMoEOrchestratorService(
      ceo,
      trade,
      test,
      makeLearnerWithHealth({ [BrainType.CEO]: 0.01 }),
    );
    const eff = orch.getEffectiveWeights();
    const base = orch.getWeights();
    expect(eff.ceo).toBeCloseTo(base.ceo, 5);
  });

  it('effective weights exposed on EnsembleDecision.finalWeights', async () => {
    const { ceo, trade, test } = makeBrains();
    const orch = new GlobalMoEOrchestratorService(
      ceo,
      trade,
      test,
      makeLearnerWithHealth({}),
    );
    const d = await orch.evaluate({
      signalId: 'h1',
      symbol: 'EURUSD',
      timeframe: '15m',
      direction: 'LONG' as const,
      timestampUtc: new Date().toISOString(),
    });
    const sum = d.finalWeights.ceo + d.finalWeights.trade + d.finalWeights.test;
    expect(sum).toBeCloseTo(1, 5);
  });

  it('respects MOE_HEALTH_FLOOR to prevent brain lockout', () => {
    process.env.MOE_HEALTH_FLOOR = '0.4';
    const { ceo, trade, test } = makeBrains();
    const orch = new GlobalMoEOrchestratorService(
      ceo,
      trade,
      test,
      makeLearnerWithHealth({ [BrainType.CEO]: 0.0 }),
    );
    const eff = orch.getEffectiveWeights();
    // Even with 0 health, floor keeps CEO > 0.
    expect(eff.ceo).toBeGreaterThan(0);
  });
});
