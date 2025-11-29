import { Test, TestingModule } from '@nestjs/testing';
import { BacktestService } from '../../../backtest/backtest.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BacktestRun } from '../../../database/entities/backtest-run.entity';
import { BacktestTrade } from '../../../database/entities/backtest-trade.entity';
import { BacktestRunStatus } from '../../../shared/dto/backtest.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { Environment } from '../../../shared/dto/canonical-signal.dto';

const mockRepository = {
  create: jest.fn((entity) => entity),
  save: jest.fn((entity) => Promise.resolve(entity)),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('BacktestService', () => {
  let service: BacktestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestService,
        {
          provide: getRepositoryToken(BacktestRun),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(BacktestTrade),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken('backtest'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<BacktestService>(BacktestService);
    jest.clearAllMocks();
  });

  it('should create QUEUED backtest run and enqueue job', async () => {
    const request = {
      symbols: ['XAUUSD'],
      timeframes: [Timeframe.ONE_MINUTE],
      strategy_ids: ['bb_rsi_buy_v1'],
      from_date: '2025-01-01',
      to_date: '2025-01-31',
      initial_balance: 1000,
      risk_profile_id: 'PROFILE_DEFAULT',
      environment: Environment.BACKTEST,
    };

    const summary = await service.startBacktest(request);

    expect(summary.status).toBe(BacktestRunStatus.QUEUED);
    expect(mockRepository.save).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      'run',
      expect.objectContaining({ dto: request }),
      expect.any(Object),
    );
  });

  it('should insert run into database with correct fields', async () => {
    const request = {
      symbols: ['EURUSD', 'XAUUSD'],
      timeframes: [Timeframe.FIVE_MINUTE],
      strategy_ids: ['bb_rsi_buy_v1', 'bb_rsi_sell_v1'],
      from_date: '2025-01-15',
      to_date: '2025-01-20',
      initial_balance: 5000,
      risk_profile_id: 'PROFILE_AGGRESSIVE',
      environment: Environment.BACKTEST,
    };

    await service.startBacktest(request);

    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BacktestRunStatus.QUEUED,
        symbols: JSON.stringify(['EURUSD', 'XAUUSD']),
        timeframes: JSON.stringify([Timeframe.FIVE_MINUTE]),
        initial_balance: 5000,
      }),
    );
  });
});
