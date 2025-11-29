import { Test, TestingModule } from '@nestjs/testing';
import { TFResamplerService } from '../../../data/resample/tf-resampler.service';
import { OhlcvBarDTO } from '../../../shared/dto/ohlcv-bar.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { getQueueToken } from '@nestjs/bull';

const mockQueue = {
  add: jest.fn(),
};

describe('TFResamplerService', () => {
  let service: TFResamplerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TFResamplerService,
        {
          provide: getQueueToken('tf-resample'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<TFResamplerService>(TFResamplerService);
    jest.clearAllMocks();
  });

  it('should resample 60 x 1s bars into 1 x 1m bar', () => {
    const bars: OhlcvBarDTO[] = Array.from({ length: 60 }, (_, i) => ({
      symbol: 'XAUUSD',
      tf: Timeframe.ONE_SECOND,
      ts_utc: new Date(Date.UTC(2025, 0, 18, 10, 0, i)).toISOString(),
      open: 2035.0 + i * 0.01,
      high: 2035.5 + i * 0.01,
      low: 2034.5 + i * 0.01,
      close: 2035.2 + i * 0.01,
      volume: 10 + i,
      source: 'TEST',
    }));

    const result = service.resampleBars({
      fromTf: Timeframe.ONE_SECOND,
      toTf: Timeframe.ONE_MINUTE,
      bars,
    });

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('XAUUSD');
    expect(result[0].tf).toBe(Timeframe.ONE_MINUTE);
    expect(result[0].open).toBe(bars[0].open);
    expect(result[0].close).toBe(bars[59].close);
    expect(result[0].high).toBe(Math.max(...bars.map((b) => b.high)));
    expect(result[0].low).toBe(Math.min(...bars.map((b) => b.low)));
    expect(result[0].volume).toBe(bars.reduce((sum, b) => sum + b.volume, 0));
  });

  it('should resample 120 x 1s bars into 2 x 1m bars', () => {
    const bars: OhlcvBarDTO[] = Array.from({ length: 120 }, (_, i) => ({
      symbol: 'EURUSD',
      tf: Timeframe.ONE_SECOND,
      ts_utc: new Date(Date.UTC(2025, 0, 18, 10, Math.floor(i / 60), i % 60)).toISOString(),
      open: 1.085,
      high: 1.086,
      low: 1.084,
      close: 1.085,
      volume: 100,
      source: 'TEST',
    }));

    const result = service.resampleBars({
      fromTf: Timeframe.ONE_SECOND,
      toTf: Timeframe.ONE_MINUTE,
      bars,
    });

    expect(result).toHaveLength(2);
    expect(result[0].tf).toBe(Timeframe.ONE_MINUTE);
    expect(result[1].tf).toBe(Timeframe.ONE_MINUTE);
  });

  it('should throw error when resampling to smaller timeframe', () => {
    const bars: OhlcvBarDTO[] = [
      {
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_MINUTE,
        ts_utc: '2025-01-18T10:00:00.000Z',
        open: 2035.0,
        high: 2035.5,
        low: 2034.5,
        close: 2035.2,
        volume: 100,
        source: 'TEST',
      },
    ];

    expect(() =>
      service.resampleBars({
        fromTf: Timeframe.ONE_MINUTE,
        toTf: Timeframe.ONE_SECOND,
        bars,
      }),
    ).toThrow('Cannot resample to smaller or equal timeframe');
  });

  it('should return empty array for empty input', () => {
    const result = service.resampleBars({
      fromTf: Timeframe.ONE_SECOND,
      toTf: Timeframe.ONE_MINUTE,
      bars: [],
    });

    expect(result).toHaveLength(0);
  });
});
