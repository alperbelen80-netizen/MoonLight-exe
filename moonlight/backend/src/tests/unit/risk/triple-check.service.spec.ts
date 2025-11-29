import { Test, TestingModule } from '@nestjs/testing';
import { TripleCheckService } from '../../../risk/triple-check/triple-check.service';
import { UncertaintyLevel } from '../../../shared/dto/uncertainty.dto';

describe('TripleCheckService', () => {
  let service: TripleCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripleCheckService],
    }).compile();

    service = module.get<TripleCheckService>(TripleCheckService);
  });

  it('should calculate LOW uncertainty for quality grade A', () => {
    const result = service.evaluate({
      data_quality: { quality_grade: 'A' },
    });

    expect(result.level).toBe(UncertaintyLevel.LOW);
    expect(result.uncertainty_score).toBeLessThan(0.33);
  });

  it('should calculate MEDIUM uncertainty for quality grade B', () => {
    const result = service.evaluate({
      data_quality: { quality_grade: 'B' },
    });

    expect(result.level).toBe(UncertaintyLevel.LOW);
  });

  it('should calculate HIGH uncertainty for quality grade REJECTED', () => {
    const result = service.evaluate({
      data_quality: { quality_grade: 'REJECTED' },
    });

    expect(result.level).toBe(UncertaintyLevel.MEDIUM);
  });

  it('should include u1, u2, u3 scores', () => {
    const result = service.evaluate({});

    expect(result.u1_score).toBeGreaterThanOrEqual(0);
    expect(result.u2_score).toBeGreaterThanOrEqual(0);
    expect(result.u3_score).toBeGreaterThanOrEqual(0);
  });
});
