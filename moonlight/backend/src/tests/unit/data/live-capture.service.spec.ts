import { Test, TestingModule } from '@nestjs/testing';
import { LiveCaptureService } from '../../../data/capture/live-capture.service';
import { TickCaptureDTO } from '../../../shared/dto/tick-capture.dto';
import { OhlcvBarDTO } from '../../../shared/dto/ohlcv-bar.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import * as parquetUtil from '../../../shared/utils/parquet.util';

jest.mock('../../../shared/utils/parquet.util');

describe('LiveCaptureService', () => {
  let service: LiveCaptureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiveCaptureService],
    }).compile();

    service = module.get<LiveCaptureService>(LiveCaptureService);
    jest.clearAllMocks();
  });

  it('should write bars to Parquet grouped by symbol and tf', async () => {
    const bars: OhlcvBarDTO[] = [
      {
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_SECOND,
        ts_utc: '2025-01-18T10:00:00.000Z',
        open: 2035.5,
        high: 2035.8,
        low: 2035.2,
        close: 2035.6,
        volume: 100,
        source: 'TV_WEBHOOK',
      },
      {
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_SECOND,
        ts_utc: '2025-01-18T10:00:01.000Z',
        open: 2035.6,
        high: 2035.9,
        low: 2035.5,
        close: 2035.7,
        volume: 120,
        source: 'TV_WEBHOOK',
      },
    ];

    const input: TickCaptureDTO = {
      bars,
      data_source: 'TV_WEBHOOK',
    };

    await service.captureBars(input);

    expect(parquetUtil.writeOhlcvBarsToParquet).toHaveBeenCalledTimes(1);
    expect(parquetUtil.writeOhlcvBarsToParquet).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_SECOND,
        bars: expect.arrayContaining(bars),
      }),
    );
  });

  it('should group bars by different symbols into separate writes', async () => {
    const bars: OhlcvBarDTO[] = [
      {
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_MINUTE,
        ts_utc: '2025-01-18T10:00:00.000Z',
        open: 2035.5,
        high: 2035.8,
        low: 2035.2,
        close: 2035.6,
        volume: 100,
        source: 'TV',
      },
      {
        symbol: 'EURUSD',
        tf: Timeframe.ONE_MINUTE,
        ts_utc: '2025-01-18T10:00:00.000Z',
        open: 1.0850,
        high: 1.0855,
        low: 1.0848,
        close: 1.0852,
        volume: 200,
        source: 'TV',
      },
    ];

    const input: TickCaptureDTO = {
      bars,
      data_source: 'TV',
    };

    await service.captureBars(input);

    expect(parquetUtil.writeOhlcvBarsToParquet).toHaveBeenCalledTimes(2);
  });

  it('should handle empty bars gracefully', async () => {
    const input: TickCaptureDTO = {
      bars: [],
      data_source: 'TEST',
    };

    await service.captureBars(input);

    expect(parquetUtil.writeOhlcvBarsToParquet).not.toHaveBeenCalled();
  });
});
