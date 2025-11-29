import { Test, TestingModule } from '@nestjs/testing';
import { GatingService } from '../../../strategy/gating/gating.service';
import { GatingDecision } from '../../../strategy/gating/gating.types';

describe('GatingService', () => {
  let service: GatingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatingService],
    }).compile();

    service = module.get<GatingService>(GatingService);
  });

  it('should select signal with highest score', () => {
    const signals = [
      { signal_id: 'SIG_1', ev: 0.05 },
      { signal_id: 'SIG_2', ev: 0.08 },
    ];

    const scores = { SIG_1: 0.03, SIG_2: 0.06 };

    const result = service.selectOne({ signals, scores, threshold_delta: 0.01 });

    expect(result.decision).toBe(GatingDecision.SELECT_ONE);
    expect(result.selected_signal.signal_id).toBe('SIG_2');
  });

  it('should reject all when scores too close', () => {
    const signals = [
      { signal_id: 'SIG_1', ev: 0.05 },
      { signal_id: 'SIG_2', ev: 0.05 },
    ];

    const scores = { SIG_1: 0.0500, SIG_2: 0.0505 };

    const result = service.selectOne({ signals, scores, threshold_delta: 0.01 });

    expect(result.decision).toBe(GatingDecision.REJECT_ALL);
    expect(result.reason_codes).toContain('SCORES_TOO_CLOSE');
  });

  it('should select single signal without comparison', () => {
    const signals = [{ signal_id: 'SIG_ONLY', ev: 0.05 }];
    const scores = { SIG_ONLY: 0.04 };

    const result = service.selectOne({ signals, scores, threshold_delta: 0.01 });

    expect(result.decision).toBe(GatingDecision.SELECT_ONE);
    expect(result.selected_signal.signal_id).toBe('SIG_ONLY');
  });
});
