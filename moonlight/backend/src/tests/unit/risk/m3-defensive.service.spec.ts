import { Test, TestingModule } from '@nestjs/testing';
import { M3DefensiveService } from '../../../risk/m3-defensive.service';
import { M3Mode, M3FinalAction } from '../../../shared/dto/m3-decision.dto';

describe('M3DefensiveService', () => {
  let service: M3DefensiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [M3DefensiveService],
    }).compile();

    service = module.get<M3DefensiveService>(M3DefensiveService);
  });

  it('should return EXECUTE for AUTO mode with LOW uncertainty', () => {
    const decision = service.decide({
      mode: M3Mode.AUTO,
      tripleCheck: {
        u1_score: 0.1,
        u2_score: 0.1,
        u3_score: 0.1,
        uncertainty_score: 0.1,
        level: 'LOW',
      },
    });

    expect(decision.final_action).toBe(M3FinalAction.EXECUTE);
  });

  it('should return ABSTAIN for AUTO mode with HIGH uncertainty', () => {
    const decision = service.decide({
      mode: M3Mode.AUTO,
      tripleCheck: {
        u1_score: 0.7,
        u2_score: 0.7,
        u3_score: 0.7,
        uncertainty_score: 0.7,
        level: 'HIGH',
      },
    });

    expect(decision.final_action).toBe(M3FinalAction.ABSTAIN);
  });

  it('should return HUMAN_APPROVAL for GUARD mode with HIGH uncertainty', () => {
    const decision = service.decide({
      mode: M3Mode.GUARD,
      tripleCheck: {
        u1_score: 0.7,
        u2_score: 0.7,
        u3_score: 0.7,
        uncertainty_score: 0.7,
        level: 'HIGH',
      },
    });

    expect(decision.final_action).toBe(M3FinalAction.HUMAN_APPROVAL);
  });

  it('should return ABSTAIN for ANALYSIS mode regardless of uncertainty', () => {
    const decision = service.decide({
      mode: M3Mode.ANALYSIS,
      tripleCheck: {
        u1_score: 0.1,
        u2_score: 0.1,
        u3_score: 0.1,
        uncertainty_score: 0.1,
        level: 'LOW',
      },
    });

    expect(decision.final_action).toBe(M3FinalAction.ABSTAIN);
  });
});
