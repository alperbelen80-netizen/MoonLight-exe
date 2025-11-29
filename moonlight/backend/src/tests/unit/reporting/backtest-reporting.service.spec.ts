import { Test, TestingModule } from '@nestjs/testing';
import { BacktestReportingService } from '../../../reporting/backtest-reporting.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BacktestRun } from '../../../database/entities/backtest-run.entity';
import { BacktestTrade } from '../../../database/entities/backtest-trade.entity';
import { BacktestRunStatus } from '../../../shared/dto/backtest.dto';

const mockBacktestRun = {
  run_id: 'RUN_TEST',
  status: BacktestRunStatus.COMPLETED,
  symbols: JSON.stringify(['XAUUSD']),
  timeframes: JSON.stringify(['1m']),
  strategy_ids: JSON.stringify(['bb_rsi_buy_v1']),
  from_date: '2025-01-01',
  to_date: '2025-01-31',
  initial_balance: 1000,
  total_trades: 10,
  win_rate: 0.6,
  net_pnl: 50,
  max_drawdown: 20,
  blocked_by_risk_count: 2,
  cancelled_trades_count: 0,
  created_at_utc: new Date(),
  updated_at_utc: new Date(),
};

const mockTrades = [
  {
    id: 1,
    run_id: 'RUN_TEST',
    trade_uid: 'TRD_001',
    symbol: 'XAUUSD',
    tf: '1m',
    strategy_id: 'bb_rsi_buy_v1',
    entry_ts_utc: new Date('2025-01-01T10:00:00Z'),
    exit_ts_utc: new Date('2025-01-01T10:01:00Z'),
    direction: 'CALL',
    stake_amount: 25,
    gross_pnl: 21.25,
    net_pnl: 21.25,
    outcome: 'WIN',
    payout_ratio: 0.85,
    health_score: 90,
  },
  {
    id: 2,
    run_id: 'RUN_TEST',
    trade_uid: 'TRD_002',
    symbol: 'XAUUSD',
    tf: '1m',
    strategy_id: 'bb_rsi_buy_v1',
    entry_ts_utc: new Date('2025-01-01T11:00:00Z'),
    exit_ts_utc: new Date('2025-01-01T11:01:00Z'),
    direction: 'PUT',
    stake_amount: 25,
    gross_pnl: -25,
    net_pnl: -25,
    outcome: 'LOSS',
    payout_ratio: 0.85,
    health_score: 40,
  },
];

const mockRunRepo = {
  findOne: jest.fn().mockResolvedValue(mockBacktestRun),
};

const mockTradeRepo = {
  find: jest.fn().mockResolvedValue(mockTrades),
};

describe('BacktestReportingService', () => {
  let service: BacktestReportingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestReportingService,
        {
          provide: getRepositoryToken(BacktestRun),
          useValue: mockRunRepo,
        },
        {
          provide: getRepositoryToken(BacktestTrade),
          useValue: mockTradeRepo,
        },
      ],
    }).compile();

    service = module.get<BacktestReportingService>(BacktestReportingService);
    jest.clearAllMocks();
  });

  it('should build advanced report with all metrics', async () => {
    const report = await service.buildAdvancedReport('RUN_TEST');

    expect(report.run_id).toBe('RUN_TEST');
    expect(report.summary.total_trades).toBe(10);
    expect(report.sharpe_ratio).toBeDefined();
    expect(report.profit_factor).toBeDefined();
    expect(report.expectancy_per_trade).toBeDefined();
    expect(report.max_consecutive_wins).toBeGreaterThanOrEqual(0);
    expect(report.max_consecutive_losses).toBeGreaterThanOrEqual(0);
  });

  it('should provide per-symbol breakdown', async () => {
    const report = await service.buildAdvancedReport('RUN_TEST');

    expect(report.per_symbol.length).toBeGreaterThan(0);
    expect(report.per_symbol[0].key).toBe('XAUUSD');
  });

  it('should build equity curve', async () => {
    const report = await service.buildAdvancedReport('RUN_TEST');

    expect(report.equity_curve.length).toBeGreaterThan(0);
    expect(report.equity_curve[0].equity).toBe(1000);
  });
});
