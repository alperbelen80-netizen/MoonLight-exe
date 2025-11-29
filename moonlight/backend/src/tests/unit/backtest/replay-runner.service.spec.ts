import { Test, TestingModule } from '@nestjs/testing';
import { ReplayRunnerService } from '../../../backtest/replay-runner.service';
import { StrategyService } from '../../../strategy/strategy.service';
import { BacktestRunRequestDTO } from '../../../shared/dto/backtest.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { Environment } from '../../../shared/dto/canonical-signal.dto';
import * as parquetUtil from '../../../shared/utils/parquet.util';

jest.mock('../../../shared/utils/parquet.util');

describe('ReplayRunnerService', () => {
  let service: ReplayRunnerService;
  let strategyService: StrategyService;

  beforeEach(async () => {
    const mockStrategyService = {
      evaluateStrategiesForContext: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayRunnerService,
        {
          provide: StrategyService,
          useValue: mockStrategyService,
        },
      ],
    }).compile();

    service = module.get<ReplayRunnerService>(ReplayRunnerService);
    strategyService = module.get<StrategyService>(StrategyService);
    jest.clearAllMocks();
  });

  it('should calculate positive PnL for winning trades', async () => {
    const mockBars = Array.from({ length: 50 }, (_, i) => ({
      symbol: 'XAUUSD',
      tf: Timeframe.ONE_MINUTE,
      ts_utc: new Date(Date.UTC(2025, 0, 18, 10, i)).toISOString(),
      open: 2035 + i * 0.1,
      high: 2035.5 + i * 0.1,
      low: 2034.5 + i * 0.1,
      close: 2035 + i * 0.1,
      volume: 100,
      source: 'TEST',
    }));

    (parquetUtil.readOhlcvBarsBetweenDates as jest.Mock).mockResolvedValue(mockBars);

    (strategyService.evaluateStrategiesForContext as jest.Mock).mockResolvedValue([
      {
        signal_id: 'SIG_TEST',
        source: 'test',
        symbol: 'XAUUSD',
        tf: Timeframe.ONE_MINUTE,
        direction: 'CALL',
        ev: 0.05,
        confidence_score: 0.7,
        ts: mockBars[25].ts_utc,
        valid_until: new Date().toISOString(),
        latency_budget_ms: 200,
        schema_version: 1,
        environment: Environment.BACKTEST,
        idempotency_key: 'test',
      },
    ]);

    const request: BacktestRunRequestDTO = {
      symbols: ['XAUUSD'],
      timeframes: [Timeframe.ONE_MINUTE],
      strategy_ids: ['test_strategy'],
      from_date: '2025-01-18',
      to_date: '2025-01-18',
      initial_balance: 1000,
      risk_profile_id: 'PROFILE_TEST',
      environment: Environment.BACKTEST,
    };

    const result = await service.runBacktest({ runId: 'TEST_RUN', request });

    expect(result.total_trades).toBeGreaterThan(0);
  });

  it('should handle insufficient bars gracefully', async () => {
    (parquetUtil.readOhlcvBarsBetweenDates as jest.Mock).mockResolvedValue([]);

    const request: BacktestRunRequestDTO = {
      symbols: ['XAUUSD'],
      timeframes: [Timeframe.ONE_MINUTE],
      strategy_ids: ['test_strategy'],
      from_date: '2025-01-18',
      to_date: '2025-01-18',
      initial_balance: 1000,
      risk_profile_id: 'PROFILE_TEST',
      environment: Environment.BACKTEST,
    };

    const result = await service.runBacktest({ runId: 'TEST_RUN', request });

    expect(result.total_trades).toBe(0);
    expect(result.net_pnl).toBe(0);
  });
});
