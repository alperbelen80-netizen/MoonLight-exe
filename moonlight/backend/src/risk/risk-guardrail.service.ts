import { Injectable, Logger } from '@nestjs/common';
import {
  RiskProfileDTO,
  RiskGuardrailDecision,
  RiskContextSnapshot,
  RiskViolationCode,
} from '../shared/dto/risk-profile.dto';

@Injectable()
export class RiskGuardrailService {
  private readonly logger = new Logger(RiskGuardrailService.name);

  evaluateForBacktest(params: {
    profile: RiskProfileDTO;
    context: RiskContextSnapshot;
    requested_stake: number;
  }): RiskGuardrailDecision {
    const { profile, context, requested_stake } = params;
    const violations: RiskViolationCode[] = [];

    if (context.today_loss_pct <= -profile.max_daily_loss_pct) {
      violations.push('MAX_DAILY_LOSS');
      this.logger.warn(
        `Daily loss limit exceeded: ${(context.today_loss_pct * 100).toFixed(2)}% >= ${(profile.max_daily_loss_pct * 100).toFixed(2)}%`,
      );
    }

    const maxPerTrade = context.equity * profile.max_per_trade_pct;
    if (requested_stake > maxPerTrade) {
      violations.push('PER_TRADE_LIMIT');
      this.logger.warn(
        `Per-trade limit exceeded: $${requested_stake} > $${maxPerTrade.toFixed(2)}`,
      );
    }

    if (context.open_trades_count >= profile.max_concurrent_trades) {
      violations.push('MAX_CONCURRENT_TRADES');
      this.logger.warn(
        `Max concurrent trades exceeded: ${context.open_trades_count} >= ${profile.max_concurrent_trades}`,
      );
    }

    if (context.symbol_exposure_pct > profile.max_exposure_per_symbol_pct) {
      violations.push('SYMBOL_EXPOSURE');
      this.logger.warn(
        `Symbol exposure limit exceeded: ${(context.symbol_exposure_pct * 100).toFixed(2)}% > ${(profile.max_exposure_per_symbol_pct * 100).toFixed(2)}%`,
      );
    }

    const allowed = violations.length === 0;
    const effectiveStakeAmount = allowed ? requested_stake : 0;

    return {
      allowed,
      violations,
      effective_stake_amount: effectiveStakeAmount,
    };
  }
}
