import { Test, TestingModule } from '@nestjs/testing';
import { ConfigSnapshotService } from '../../../config/config-snapshot.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigSnapshot } from '../../../database/entities/config-snapshot.entity';
import { ConfigSnapshotScope } from '../../../shared/dto/config-snapshot.dto';
import { BacktestRunRequestDTO } from '../../../shared/dto/backtest.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { Environment } from '../../../shared/dto/canonical-signal.dto';

const mockRepo = {
  create: jest.fn((entity) => entity),
  save: jest.fn((entity) => Promise.resolve(entity)),
  findOne: jest.fn(),
};

describe('ConfigSnapshotService', () => {
  let service: ConfigSnapshotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigSnapshotService,
        {
          provide: getRepositoryToken(ConfigSnapshot),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ConfigSnapshotService>(ConfigSnapshotService);
    jest.clearAllMocks();
  });

  it('should create backtest run snapshot with correct scope and refId', async () => {
    const request: BacktestRunRequestDTO = {
      symbols: ['XAUUSD'],
      timeframes: [Timeframe.ONE_MINUTE],
      strategy_ids: ['bb_rsi_buy_v1'],
      from_date: '2025-01-01',
      to_date: '2025-01-31',
      initial_balance: 1000,
      risk_profile_id: 'PROFILE_TEST',
      environment: Environment.BACKTEST,
    };

    const riskProfile = {
      id: 'PROFILE_TEST',
      name: 'Test',
      max_per_trade_pct: 0.02,
      max_daily_loss_pct: 0.1,
      max_concurrent_trades: 5,
      max_exposure_per_symbol_pct: 0.3,
      enabled: true,
      created_at_utc: new Date().toISOString(),
      updated_at_utc: new Date().toISOString(),
    };

    await service.createBacktestRunSnapshot({
      runId: 'RUN_123',
      request,
      riskProfile,
      strategies: [],
      presets: [],
      createdBy: 'test_user',
    });

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ConfigSnapshotScope.BACKTEST_RUN,
        ref_id: 'RUN_123',
        created_by: 'test_user',
      }),
    );
  });

  it('should store payload as JSON string', async () => {
    const request: BacktestRunRequestDTO = {
      symbols: ['EURUSD'],
      timeframes: [Timeframe.FIVE_MINUTE],
      strategy_ids: ['rsi_mean_revert_1m'],
      from_date: '2025-01-10',
      to_date: '2025-01-15',
      initial_balance: 500,
      risk_profile_id: 'PROFILE_TEST',
      environment: Environment.BACKTEST,
    };

    const riskProfile = {
      id: 'PROFILE_TEST',
      name: 'Test',
      max_per_trade_pct: 0.02,
      max_daily_loss_pct: 0.1,
      max_concurrent_trades: 5,
      max_exposure_per_symbol_pct: 0.3,
      enabled: true,
      created_at_utc: new Date().toISOString(),
      updated_at_utc: new Date().toISOString(),
    };

    await service.createBacktestRunSnapshot({
      runId: 'RUN_456',
      request,
      riskProfile,
      strategies: [],
      presets: [],
    });

    const savedCall = mockRepo.save.mock.calls[0][0];
    expect(savedCall.payload_json).toBeDefined();
    expect(typeof savedCall.payload_json).toBe('string');

    const parsed = JSON.parse(savedCall.payload_json);
    expect(parsed.runId).toBe('RUN_456');
  });
});
