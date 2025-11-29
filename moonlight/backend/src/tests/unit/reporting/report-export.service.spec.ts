import { Test, TestingModule } from '@nestjs/testing';
import { ReportExportService } from '../../../reporting/report-export.service';
import { BacktestReportingService } from '../../../reporting/backtest-reporting.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BacktestTrade } from '../../../database/entities/backtest-trade.entity';

const mockTrades = [
  {
    id: 1,
    run_id: 'RUN_CSV_TEST',
    trade_uid: 'TRD_CSV_001',
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
];

const mockTradeRepo = {
  find: jest.fn().mockResolvedValue(mockTrades),
};

const mockBacktestReportingService = {
  buildAdvancedReport: jest.fn().mockResolvedValue({
    run_id: 'RUN_XLSX_TEST',
    summary: {
      run_id: 'RUN_XLSX_TEST',
      status: 'COMPLETED',
      symbols: ['XAUUSD'],
      timeframes: ['1m'],
      strategy_ids: ['bb_rsi_buy_v1'],
      from_date: '2025-01-01',
      to_date: '2025-01-31',
      total_trades: 10,
      win_rate: 0.6,
      net_pnl: 50,
      max_drawdown: 20,
      created_at_utc: new Date().toISOString(),
      updated_at_utc: new Date().toISOString(),
    },
    sharpe_ratio: 1.5,
    profit_factor: 2.0,
    expectancy_per_trade: 5.0,
    max_consecutive_wins: 3,
    max_consecutive_losses: 2,
    per_symbol: [],
    per_timeframe: [],
    per_strategy: [],
    equity_curve: [],
  }),
};

describe('ReportExportService', () => {
  let service: ReportExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportExportService,
        {
          provide: getRepositoryToken(BacktestTrade),
          useValue: mockTradeRepo,
        },
        {
          provide: BacktestReportingService,
          useValue: mockBacktestReportingService,
        },
      ],
    }).compile();

    service = module.get<ReportExportService>(ReportExportService);
    jest.clearAllMocks();
  });

  it('should export CSV with header and data rows', async () => {
    const { filename, content } = await service.exportBacktestToCsv('RUN_CSV_TEST');

    expect(filename).toContain('backtest_RUN_CSV_TEST.csv');
    expect(content).toContain('trade_uid,symbol,tf');
    expect(content.split('\n').length).toBeGreaterThanOrEqual(2);
    expect(content).toContain('TRD_CSV_001');
  });

  it('should export XLSX with 2 sheets (SUMMARY and TRADES)', async () => {
    const { filename, buffer } = await service.exportBacktestToXlsx('RUN_XLSX_TEST');

    expect(filename).toContain('backtest_RUN_XLSX_TEST.xlsx');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
