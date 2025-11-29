import { Test, TestingModule } from '@nestjs/testing';
import { ReplayRunnerService } from '../../../backtest/replay-runner.service';
import { StrategyService } from '../../../strategy/strategy.service';
import { RiskProfileService } from '../../../risk/risk-profile.service';
import { RiskGuardrailService } from '../../../risk/risk-guardrail.service';
import { BacktestRunRequestDTO } from '../../../shared/dto/backtest.dto';
import { Timeframe } from '../../../shared/enums/timeframe.enum';
import { Environment } from '../../../shared/dto/canonical-signal.dto';
import * as parquetUtil from '../../../shared/utils/parquet.util';

jest.mock('../../../shared/utils/parquet.util');

describe('ReplayRunnerService', () => {
  let service: ReplayRunnerService;

  const mockStrategyService = {
    evaluateStrategiesForContext: jest.fn().mockResolvedValue([]),
  };

  const mockRiskProfileService = {
    getById: jest.fn().mockResolvedValue(null),
    getDefaultProfile: jest.fn().mockResolvedValue({
      id: 'PROFILE_DEFAULT',
      name: 'Default',
      max_per_trade_pct: 0.02,
      max_daily_loss_pct: 0.1,
      max_concurrent_trades: 5,
      max_exposure_per_symbol_pct: 0.3,
      enabled: true,
      created_at_utc: new Date().toISOString(),
      updated_at_utc: new Date().toISOString(),
    }),
  };

  const mockRiskGuardrailService = {
    evaluateForBacktest: jest.fn().mockReturnValue({
      allowed: true,
      violations: [],
      effective_stake_amount: 25,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayRunnerService,
        {
          provide: StrategyService,
          useValue: mockStrategyService,
        },
        {
          provide: RiskProfileService,
          useValue: mockRiskProfileService,
        },
        {
          provide: RiskGuardrailService,
          useValue: mockRiskGuardrailService,
        },
      ],
    }).compile();

    service = module.get<ReplayRunnerService>(ReplayRunnerService);
    jest.clearAllMocks();
  });

  it('should handle backtest with risk checks', async () => {
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
    expect(result.blocked_by_risk_count).toBe(0);
  });
});
