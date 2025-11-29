import { Test, TestingModule } from '@nestjs/testing';
import { IndicatorService } from '../../../strategy/indicators/indicator.service';
import { OhlcvBarDTO } from '../../../shared/dto/ohlcv-bar.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';

describe('IndicatorService', () => {
  let service: IndicatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndicatorService],
    }).compile();

    service = module.get<IndicatorService>(IndicatorService);
  });

  const createMockBars = (count: number, trend: 'UP' | 'DOWN' | 'FLAT'): OhlcvBarDTO[] => {
    return Array.from({ length: count }, (_, i) => {
      let close = 100;
      if (trend === 'UP') {
        close = 100 + i * 0.5;
      } else if (trend === 'DOWN') {
        close = 100 - i * 0.5;
      }

      return {
        symbol: 'TEST',
        tf: Timeframe.ONE_MINUTE,
        ts_utc: new Date(Date.UTC(2025, 0, 18, 10, i)).toISOString(),
        open: close - 0.2,
        high: close + 0.3,
        low: close - 0.3,
        close,
        volume: 100,
        source: 'TEST',
      };
    });
  };

  it('should calculate RSI for uptrend (expect RSI > 50)', () => {
    const bars = createMockBars(30, 'UP');

    const rsi = service.calculateRSI(bars, 14);

    expect(rsi).not.toBeNull();
    expect(rsi!.value).toBeGreaterThan(50);
  });

  it('should calculate RSI for downtrend (expect RSI < 50)', () => {
    const bars = createMockBars(30, 'DOWN');

    const rsi = service.calculateRSI(bars, 14);

    expect(rsi).not.toBeNull();
    expect(rsi!.value).toBeLessThan(50);
  });

  it('should calculate BB width correctly', () => {
    const bars = createMockBars(30, 'FLAT');

    const bb = service.calculateBB(bars, 20, 2.0);

    expect(bb).not.toBeNull();
    expect(bb!.middle).toBeCloseTo(100, 1);
    expect(bb!.upper).toBeGreaterThan(bb!.middle);
    expect(bb!.lower).toBeLessThan(bb!.middle);
    expect(bb!.width).toBeGreaterThan(0);
  });

  it('should calculate MACD histogram', () => {
    const bars = createMockBars(50, 'UP');

    const macd = service.calculateMACD(bars, 12, 26, 9);

    expect(macd).not.toBeNull();
    expect(macd!.histogram).toBeDefined();
  });

  it('should calculate EMA smoothing', () => {
    const bars = createMockBars(30, 'FLAT');

    const ema = service.calculateEMA(bars, 20);

    expect(ema).not.toBeNull();
    expect(ema!.value).toBeCloseTo(100, 1);
  });

  it('should return null when insufficient bars for RSI', () => {
    const bars = createMockBars(10, 'FLAT');

    const rsi = service.calculateRSI(bars, 14);

    expect(rsi).toBeNull();
  });

  it('should return null when insufficient bars for BB', () => {
    const bars = createMockBars(15, 'FLAT');

    const bb = service.calculateBB(bars, 20, 2.0);

    expect(bb).toBeNull();
  });
});
