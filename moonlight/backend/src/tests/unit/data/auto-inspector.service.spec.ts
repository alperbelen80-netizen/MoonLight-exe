import { Test, TestingModule } from '@nestjs/testing';
import { AutoInspectorService } from '../../../data/inspector/auto-inspector.service';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { QualityGrade } from '../../../shared/dto/data-quality-snapshot.dto';

describe('AutoInspectorService', () => {
  let service: AutoInspectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutoInspectorService],
    }).compile();

    service = module.get<AutoInspectorService>(AutoInspectorService);
  });

  it('should assign grade A for coverage 99.5%, gap 0.2%', () => {
    const result = service.inspectDay({
      symbol: 'XAUUSD',
      tf: Timeframe.ONE_MINUTE,
      date: '2025-01-18',
      actualTimestamps: Array.from({ length: 1433 }, (_, i) => `ts_${i}`),
      dataSource: 'TV',
    });

    expect(result.quality_grade).toBe(QualityGrade.A);
    expect(result.coverage_pct).toBeCloseTo(99.51, 1);
    expect(result.total_expected_bars).toBe(1440);
    expect(result.total_actual_bars).toBe(1433);
  });

  it('should assign grade B for coverage 96%, gap 4%', () => {
    const result = service.inspectDay({
      symbol: 'EURUSD',
      tf: Timeframe.FIVE_MINUTE,
      date: '2025-01-18',
      actualTimestamps: Array.from({ length: 276 }, (_, i) => `ts_${i}`),
      dataSource: 'BROKER',
    });

    expect(result.quality_grade).toBe(QualityGrade.B);
    expect(result.coverage_pct).toBeCloseTo(95.83, 1);
  });

  it('should assign grade C for coverage 92%, gap 8%', () => {
    const result = service.inspectDay({
      symbol: 'BTCUSD',
      tf: Timeframe.ONE_MINUTE,
      date: '2025-01-18',
      actualTimestamps: Array.from({ length: 1325 }, (_, i) => `ts_${i}`),
      dataSource: 'EXCHANGE',
    });

    expect(result.quality_grade).toBe(QualityGrade.C);
    expect(result.coverage_pct).toBeCloseTo(92.01, 1);
  });

  it('should assign grade REJECTED for coverage below 90%', () => {
    const result = service.inspectDay({
      symbol: 'XAGUSD',
      tf: Timeframe.ONE_MINUTE,
      date: '2025-01-18',
      actualTimestamps: Array.from({ length: 1152 }, (_, i) => `ts_${i}`),
      dataSource: 'LOW_QUALITY',
    });

    expect(result.quality_grade).toBe(QualityGrade.REJECTED);
    expect(result.coverage_pct).toBe(80.0);
    expect(result.gap_pct).toBe(20.0);
  });

  it('should calculate gaps correctly', () => {
    const result = service.inspectDay({
      symbol: 'XAUUSD',
      tf: Timeframe.ONE_MINUTE,
      date: '2025-01-18',
      actualTimestamps: Array.from({ length: 1400 }, (_, i) => `ts_${i}`),
      dataSource: 'TEST',
    });

    expect(result.total_expected_bars).toBe(1440);
    expect(result.total_actual_bars).toBe(1400);
    expect(result.total_gaps).toBe(40);
  });
});
