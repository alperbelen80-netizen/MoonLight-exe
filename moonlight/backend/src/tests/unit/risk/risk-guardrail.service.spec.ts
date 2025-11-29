import { Test, TestingModule } from '@nestjs/testing';
import { RiskGuardrailService } from '../../../risk/risk-guardrail.service';
import { RiskProfileDTO, RiskContextSnapshot } from '../../../shared/dto/risk-profile.dto';

describe('RiskGuardrailService', () => {
  let service: RiskGuardrailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RiskGuardrailService],
    }).compile();

    service = module.get<RiskGuardrailService>(RiskGuardrailService);
  });

  const mockProfile: RiskProfileDTO = {
    id: 'PROFILE_TEST',
    name: 'Test Profile',
    max_per_trade_pct: 0.02,
    max_daily_loss_pct: 0.1,
    max_concurrent_trades: 5,
    max_exposure_per_symbol_pct: 0.3,
    enabled: true,
    created_at_utc: new Date().toISOString(),
    updated_at_utc: new Date().toISOString(),
  };

  it('should allow trade when no violations', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 2,
      today_loss_abs: 50,
      today_loss_pct: 0.05,
      symbol_exposure_pct: 0.1,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 20,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.violations).toHaveLength(0);
    expect(decision.effective_stake_amount).toBe(20);
  });

  it('should block trade when per-trade limit exceeded', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 2,
      today_loss_abs: 0,
      today_loss_pct: 0,
      symbol_exposure_pct: 0.1,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 100,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toContain('PER_TRADE_LIMIT');
    expect(decision.effective_stake_amount).toBe(0);
  });

  it('should block trade when daily loss limit exceeded', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 2,
      today_loss_abs: 120,
      today_loss_pct: -0.12,
      symbol_exposure_pct: 0.1,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 20,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toContain('MAX_DAILY_LOSS');
  });

  it('should block trade when max concurrent trades exceeded', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 5,
      today_loss_abs: 0,
      today_loss_pct: 0,
      symbol_exposure_pct: 0.1,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 20,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toContain('MAX_CONCURRENT_TRADES');
  });

  it('should block trade when symbol exposure limit exceeded', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 2,
      today_loss_abs: 0,
      today_loss_pct: 0,
      symbol_exposure_pct: 0.35,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 20,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toContain('SYMBOL_EXPOSURE');
  });

  it('should report multiple violations simultaneously', () => {
    const context: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 6,
      today_loss_abs: 120,
      today_loss_pct: -0.12,
      symbol_exposure_pct: 0.4,
    };

    const decision = service.evaluateForBacktest({
      profile: mockProfile,
      context,
      requested_stake: 150,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations.length).toBeGreaterThan(1);
    expect(decision.violations).toContain('MAX_DAILY_LOSS');
    expect(decision.violations).toContain('PER_TRADE_LIMIT');
    expect(decision.violations).toContain('MAX_CONCURRENT_TRADES');
    expect(decision.violations).toContain('SYMBOL_EXPOSURE');
  });
});
