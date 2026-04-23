import { Test } from '@nestjs/testing';
import { MoeEnsembleController } from '../../../moe-brain/moe-ensemble.controller';
import { GlobalMoEOrchestratorService } from '../../../moe-brain/global-moe-orchestrator.service';
import { Eye2DecisionAuditorService } from '../../../trinity-oversight/eye2-decision-auditor.service';
import { MoEDecision } from '../../../moe-brain/shared/moe.enums';
import { HttpException } from '@nestjs/common';

describe('MoeEnsembleController', () => {
  let controller: MoeEnsembleController;
  let auditor: Eye2DecisionAuditorService;

  beforeEach(async () => {
    const orchMock = {
      evaluate: jest.fn().mockResolvedValue({
        decision: MoEDecision.ALLOW,
        confidence: 0.8,
        reasonCodes: ['ENSEMBLE_ALLOW_SCORE_0.55', 'CEO_APPROVE_0.90'],
        brains: [],
        finalWeights: { ceo: 0.4, trade: 0.4, test: 0.2 },
        timestampUtc: new Date().toISOString(),
      }),
      getWeights: () => ({ ceo: 0.4, trade: 0.4, test: 0.2 }),
    };

    const mod = await Test.createTestingModule({
      controllers: [MoeEnsembleController],
      providers: [
        { provide: GlobalMoEOrchestratorService, useValue: orchMock },
        Eye2DecisionAuditorService,
      ],
    }).compile();
    controller = mod.get(MoeEnsembleController);
    auditor = mod.get(Eye2DecisionAuditorService);
    auditor.clear();
  });

  it('returns ensemble weights', () => {
    expect(controller.weights()).toEqual({ ceo: 0.4, trade: 0.4, test: 0.2 });
  });

  it('evaluate() persists audit codes', async () => {
    const out = await controller.evaluate({
      signalId: 'e-1',
      symbol: 'EURUSD',
      timeframe: '15m',
      direction: 'LONG' as const,
      timestampUtc: new Date().toISOString(),
    } as never);
    expect(out.decision).toBe(MoEDecision.ALLOW);
    const rep = auditor.report();
    expect(rep.auditedCount).toBeGreaterThan(0);
    expect(rep.recentReasonCodes.length).toBeGreaterThan(0);
  });

  it('rejects missing required fields', async () => {
    await expect(
      controller.evaluate({ symbol: 'EURUSD' } as never),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
