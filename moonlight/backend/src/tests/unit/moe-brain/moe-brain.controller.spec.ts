import { Test } from '@nestjs/testing';
import { MoeBrainController } from '../../../moe-brain/moe-brain.controller';
import { CEOBrainService } from '../../../moe-brain/brains/ceo-brain.service';
import { TRADEBrainService } from '../../../moe-brain/brains/trade-brain.service';
import { TESTBrainService } from '../../../moe-brain/brains/test-brain.service';
import { Eye2DecisionAuditorService } from '../../../trinity-oversight/eye2-decision-auditor.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';
import { ClosedLoopLearnerService } from '../../../moe-brain/learning/closed-loop-learner.service';
import { HttpException } from '@nestjs/common';

describe('MoeBrainController', () => {
  let controller: MoeBrainController;
  let auditor: Eye2DecisionAuditorService;

  beforeEach(async () => {
    const coachMock = {
      isAvailable: () => false,
      chat: jest.fn(),
      getModelName: () => 'test',
    } as unknown as AICoachService;

    const mod = await Test.createTestingModule({
      controllers: [MoeBrainController],
      providers: [
        { provide: AICoachService, useValue: coachMock },
        {
          provide: ClosedLoopLearnerService,
          useValue: {
            getPriors: () => ({
              TREND: 0.6,
              MEAN_REVERSION: 0.2,
              VOLATILITY: 0.5,
              NEWS: 0.3,
              MACRO: 0.3,
              ENTRY: 0.5,
              EXIT: 0.3,
              SLIPPAGE: 0.4,
              PAYOUT: 0.7,
              SESSION: 0.3,
              OVERFIT_HUNTER: 0.8,
              DATA_LEAK_DETECTOR: 0.9,
              BIAS_AUDITOR: 0.5,
              ADVERSARIAL_ATTACKER: 0.6,
              ROBUSTNESS_TESTER: 0.5,
            }),
          },
        },
        CEOBrainService,
        TRADEBrainService,
        TESTBrainService,
        Eye2DecisionAuditorService,
      ],
    }).compile();
    controller = mod.get(MoeBrainController);
    auditor = mod.get(Eye2DecisionAuditorService);
    auditor.clear();
  });

  const ctx = {
    signalId: 'ctrl-1',
    symbol: 'EURUSD',
    timeframe: '15m',
    direction: 'LONG' as const,
    timestampUtc: new Date().toISOString(),
    adx: 30,
    emaSlope: 0.4,
    rsi: 22,
    atrPct: 1.2,
    payoutPct: 85,
    sessionUtcHour: 14,
    confidenceScore: 0.8,
    sampleCount: 400,
    backtestWinRate: 0.58,
    backtestMaxDrawdownPct: 10,
    featureLeakSuspicion: 0.05,
  };

  it('roster() returns the 3x5 expert layout', () => {
    const r = controller.roster();
    expect(r.CEO).toHaveLength(5);
    expect(r.TRADE).toHaveLength(5);
    expect(r.TEST).toHaveLength(5);
  });

  it.each(['CEO', 'TRADE', 'TEST'])('evaluates %s brain end-to-end', async (type) => {
    const out = await controller.evaluate(type, ctx as never);
    expect(out.brain).toBe(type);
    expect(out.experts.length).toBe(5);
    expect(out.aggregate).toBeDefined();
  });

  it('rejects unknown brain type', async () => {
    await expect(controller.evaluate('PLANNER', ctx as never)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('rejects missing required fields', async () => {
    await expect(
      controller.evaluate('CEO', { symbol: 'EURUSD' } as never),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('records reason codes to audit ring buffer', async () => {
    await controller.evaluate('TEST', ctx as never);
    const report = auditor.report();
    expect(report.auditedCount).toBeGreaterThan(0);
  });
});
