import { GlobalMoEOrchestratorService } from '../../../moe-brain/global-moe-orchestrator.service';
import { CEOBrainService } from '../../../moe-brain/brains/ceo-brain.service';
import { TRADEBrainService } from '../../../moe-brain/brains/trade-brain.service';
import { TESTBrainService } from '../../../moe-brain/brains/test-brain.service';
import {
  BrainType,
  ExpertRole,
  ExpertVote,
  MoEDecision,
} from '../../../moe-brain/shared/moe.enums';
import { BrainOutput } from '../../../moe-brain/shared/moe.contracts';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';

function makeLearner(healths: Partial<Record<BrainType, number>> = {}): ClosedLoopLearnerService {
  return {
    getPriors: () => ({}),
    snapshot: () => [
      { brain: BrainType.CEO, updatedAt: '', priors: {}, health: healths[BrainType.CEO] ?? 1 },
      { brain: BrainType.TRADE, updatedAt: '', priors: {}, health: healths[BrainType.TRADE] ?? 1 },
      { brain: BrainType.TEST, updatedAt: '', priors: {}, health: healths[BrainType.TEST] ?? 1 },
    ],
  } as unknown as ClosedLoopLearnerService;
}

function makeBrainOutput(
  brain: BrainType,
  vote: ExpertVote,
  confidence: number,
  vetoFlag = false,
): BrainOutput {
  return {
    brain,
    experts: [
      { role: ExpertRole.TREND, vote, confidence, reasonCodes: ['MOCK'] },
    ],
    aggregate: { vote, confidence, weights: { [ExpertRole.TREND]: 1 } },
    vetoFlag,
    latencyMs: 1,
    timestampUtc: new Date().toISOString(),
  };
}

function makeOrchestrator(
  ceo: Partial<BrainOutput>,
  trade: Partial<BrainOutput>,
  test: Partial<BrainOutput>,
) {
  const ceoSvc = { evaluate: jest.fn().mockResolvedValue({ ...makeBrainOutput(BrainType.CEO, ExpertVote.NEUTRAL, 0.5), ...ceo }) } as unknown as CEOBrainService;
  const tradeSvc = { evaluate: jest.fn().mockResolvedValue({ ...makeBrainOutput(BrainType.TRADE, ExpertVote.NEUTRAL, 0.5), ...trade }) } as unknown as TRADEBrainService;
  const testSvc = { evaluate: jest.fn().mockResolvedValue({ ...makeBrainOutput(BrainType.TEST, ExpertVote.NEUTRAL, 0.5), ...test }) } as unknown as TESTBrainService;
  return new GlobalMoEOrchestratorService(ceoSvc, tradeSvc, testSvc, makeLearner());
}

const ctx = {
  signalId: 'e1',
  symbol: 'EURUSD',
  timeframe: '15m',
  direction: 'LONG' as const,
  timestampUtc: new Date().toISOString(),
};

describe('GlobalMoEOrchestratorService', () => {
  it('returns ALLOW when CEO+TRADE approve strongly and TEST is not veto', async () => {
    const orch = makeOrchestrator(
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.9, weights: {} } },
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.8, weights: {} } },
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.6, weights: {} }, vetoFlag: false },
    );
    const d = await orch.evaluate(ctx);
    expect(d.decision).toBe(MoEDecision.ALLOW);
    expect(d.brains.length).toBe(3);
  });

  it('returns VETO when TEST vetoFlag is true regardless of CEO/TRADE', async () => {
    const orch = makeOrchestrator(
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.95, weights: {} } },
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.95, weights: {} } },
      { aggregate: { vote: ExpertVote.REJECT, confidence: 0.9, weights: {} }, vetoFlag: true },
    );
    const d = await orch.evaluate(ctx);
    expect(d.decision).toBe(MoEDecision.VETO);
    expect(d.reasonCodes).toContain('TEST_MOE_VETO');
  });

  it('returns SKIP when CEO+TRADE reject with high confidence', async () => {
    const orch = makeOrchestrator(
      { aggregate: { vote: ExpertVote.REJECT, confidence: 0.85, weights: {} } },
      { aggregate: { vote: ExpertVote.REJECT, confidence: 0.8, weights: {} } },
      { aggregate: { vote: ExpertVote.NEUTRAL, confidence: 0.4, weights: {} } },
    );
    const d = await orch.evaluate(ctx);
    expect(d.decision).toBe(MoEDecision.SKIP);
  });

  it('returns MANUAL_REVIEW when brains conflict', async () => {
    const orch = makeOrchestrator(
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.7, weights: {} } },
      { aggregate: { vote: ExpertVote.REJECT, confidence: 0.7, weights: {} } },
      { aggregate: { vote: ExpertVote.NEUTRAL, confidence: 0.3, weights: {} } },
    );
    const d = await orch.evaluate(ctx);
    expect(d.decision).toBe(MoEDecision.MANUAL_REVIEW);
  });

  it('returns SAFE_SKIP when any brain throws', async () => {
    const ceoSvc = { evaluate: jest.fn().mockRejectedValue(new Error('boom')) } as unknown as CEOBrainService;
    const tradeSvc = { evaluate: jest.fn().mockResolvedValue(makeBrainOutput(BrainType.TRADE, ExpertVote.APPROVE, 0.9)) } as unknown as TRADEBrainService;
    const testSvc = { evaluate: jest.fn().mockResolvedValue(makeBrainOutput(BrainType.TEST, ExpertVote.NEUTRAL, 0.3)) } as unknown as TESTBrainService;
    const orch = new GlobalMoEOrchestratorService(ceoSvc, tradeSvc, testSvc, makeLearner());
    const d = await orch.evaluate(ctx);
    expect(d.decision).toBe(MoEDecision.SKIP);
    expect(d.reasonCodes.some((c) => c.includes('BRAIN_FAILURE_SAFE_SKIP'))).toBe(true);
  });

  it('respects MOE_ENSEMBLE_WEIGHTS override and normalizes to sum=1', async () => {
    const orig = process.env.MOE_ENSEMBLE_WEIGHTS;
    process.env.MOE_ENSEMBLE_WEIGHTS = 'CEO:0.6,TRADE:0.2,TEST:0.2';
    // Must construct AFTER env var is set — weights are parsed at construction time.
    const ceoSvc = { evaluate: jest.fn() } as unknown as CEOBrainService;
    const tradeSvc = { evaluate: jest.fn() } as unknown as TRADEBrainService;
    const testSvc = { evaluate: jest.fn() } as unknown as TESTBrainService;
    const orch = new GlobalMoEOrchestratorService(ceoSvc, tradeSvc, testSvc, makeLearner());
    const w = orch.getWeights();
    expect(w.ceo).toBeCloseTo(0.6, 5);
    expect(w.trade).toBeCloseTo(0.2, 5);
    expect(w.test).toBeCloseTo(0.2, 5);
    if (orig === undefined) delete process.env.MOE_ENSEMBLE_WEIGHTS;
    else process.env.MOE_ENSEMBLE_WEIGHTS = orig;
  });

  it('final reasonCodes always include brain-level summaries', async () => {
    const orch = makeOrchestrator(
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.9, weights: {} } },
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.9, weights: {} } },
      { aggregate: { vote: ExpertVote.APPROVE, confidence: 0.5, weights: {} } },
    );
    const d = await orch.evaluate(ctx);
    expect(d.reasonCodes.some((c) => c.startsWith('CEO_APPROVE_'))).toBe(true);
    expect(d.reasonCodes.some((c) => c.startsWith('TRADE_APPROVE_'))).toBe(true);
    expect(d.reasonCodes.some((c) => c.startsWith('TEST_APPROVE_'))).toBe(true);
  });
});
