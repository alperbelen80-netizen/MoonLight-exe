import { Test, TestingModule } from '@nestjs/testing';
import { SimFactoryService } from '../../../backtest/sim-factory.service';
import { BacktestService } from '../../../backtest/backtest.service';
import { SimPolicy } from '../../../shared/enums/sim-policy.enum';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { BacktestRunStatus } from '../../../shared/dto/backtest.dto';

const mockBacktestService = {
  startBacktest: jest.fn().mockResolvedValue({
    run_id: 'RUN_TEST',
    status: BacktestRunStatus.QUEUED,
    symbols: ['XAUUSD'],
    timeframes: [Timeframe.ONE_MINUTE],
    strategy_ids: ['test_preset'],
    from_date: '2025-01-01',
    to_date: '2025-01-31',
    total_trades: 0,
    win_rate: 0,
    net_pnl: 0,
    max_drawdown: 0,
    created_at_utc: new Date().toISOString(),
    updated_at_utc: new Date().toISOString(),
  }),
};

describe('SimFactoryService', () => {
  let service: SimFactoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimFactoryService,
        {
          provide: BacktestService,
          useValue: mockBacktestService,
        },
      ],
    }).compile();

    service = module.get<SimFactoryService>(SimFactoryService);
    jest.clearAllMocks();
  });

  it('should create backtest request with STRICT policy settings', async () => {
    await service.runSinglePresetBacktest({
      presetId: 'bb_rsi_buy_v1',
      symbol: 'XAUUSD',
      tf: Timeframe.ONE_MINUTE,
      fromDate: '2025-01-01',
      toDate: '2025-01-31',
      initialBalance: 1000,
      policy: SimPolicy.STRICT,
    });

    expect(mockBacktestService.startBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        symbols: ['XAUUSD'],
        timeframes: [Timeframe.ONE_MINUTE],
        strategy_ids: ['bb_rsi_buy_v1'],
        risk_profile_id: 'PROFILE_BACKTEST_STRICT',
      }),
    );
  });

  it('should create backtest request with LENIENT policy settings', async () => {
    await service.runSinglePresetBacktest({
      presetId: 'rsi_mean_revert_1m',
      symbol: 'EURUSD',
      tf: Timeframe.FIVE_MINUTE,
      fromDate: '2025-01-10',
      toDate: '2025-01-15',
      initialBalance: 500,
      policy: SimPolicy.LENIENT,
    });

    expect(mockBacktestService.startBacktest).toHaveBeenCalledWith(
      expect.objectContaining({
        risk_profile_id: 'PROFILE_BACKTEST_LENIENT',
      }),
    );
  });
});
