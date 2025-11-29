import { Test, TestingModule } from '@nestjs/testing';
import { OwnerService } from '../../../owner/owner.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BacktestRun } from '../../../database/entities/backtest-run.entity';
import { BacktestTrade } from '../../../database/entities/backtest-trade.entity';
import { BacktestRunStatus } from '../../../shared/dto/backtest.dto';

const mockRunRepo = {
  find: jest.fn().mockResolvedValue([
    {
      run_id: 'RUN_001',
      status: BacktestRunStatus.COMPLETED,
      symbols: JSON.stringify(['XAUUSD']),
      timeframes: JSON.stringify(['1m']),
      strategy_ids: JSON.stringify(['bb_rsi_buy_v1']),
      from_date: '2025-01-01',
      to_date: '2025-01-31',
      net_pnl: 100,
      win_rate: 0.65,
      created_at_utc: new Date(),
      updated_at_utc: new Date(),
    },
  ]),
};

const mockTradeRepo = {
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  }),
};

const mockQueue = {
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 2,
    active: 1,
    completed: 10,
    failed: 0,
    delayed: 0,
  }),
};

describe('OwnerService', () => {
  let service: OwnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerService,
        {
          provide: getRepositoryToken(BacktestRun),
          useValue: mockRunRepo,
        },
        {
          provide: getRepositoryToken(BacktestTrade),
          useValue: mockTradeRepo,
        },
        {
          provide: getQueueToken('backtest'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<OwnerService>(OwnerService);
    jest.clearAllMocks();
  });

  it('should return dashboard summary with all fields', async () => {
    const summary = await service.getDashboardSummary();

    expect(summary.backtest_counts_by_status).toBeDefined();
    expect(summary.backtest_counts_by_status[BacktestRunStatus.QUEUED]).toBeDefined();
    expect(summary.backtest_counts_by_status[BacktestRunStatus.COMPLETED]).toBeGreaterThanOrEqual(0);
    expect(summary.recent_runs.length).toBeGreaterThan(0);
    expect(summary.queue_health.length).toBeGreaterThan(0);
    expect(summary.generated_at_utc).toBeDefined();
  });

  it('should include queue health with job counts', async () => {
    const summary = await service.getDashboardSummary();

    const backtestQueueHealth = summary.queue_health.find((q) => q.queue_name === 'backtest');
    expect(backtestQueueHealth).toBeDefined();
    expect(backtestQueueHealth!.waiting).toBe(2);
    expect(backtestQueueHealth!.active).toBe(1);
    expect(backtestQueueHealth!.completed).toBe(10);
  });
});
