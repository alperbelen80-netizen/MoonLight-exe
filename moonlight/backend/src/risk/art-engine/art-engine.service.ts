import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import {
  AtomicRiskTokenDTO,
  ARTDecision,
  VolatilityRegime,
} from '../../shared/dto/atomic-risk-token.dto';
import { RiskLimitsConfig } from '../models/risk-limits.model';
import { signART } from './art-crypto.util';

export interface DayCapState {
  current_loss_usd: number;
  limit_usd: number;
}

@Injectable()
export class ARTEngineService {
  private readonly logger = new Logger(ARTEngineService.name);
  private dayCapState: DayCapState = {
    current_loss_usd: 0,
    limit_usd: 500,
  };

  setDayCapState(state: DayCapState): void {
    this.dayCapState = state;
  }

  getDayCapState(): DayCapState {
    return { ...this.dayCapState };
  }

  async requestART(
    signal: CanonicalSignalDTO,
    limits: RiskLimitsConfig,
    options?: {
      user_id?: string;
      account_id?: string;
      profile_id?: string;
    },
  ): Promise<AtomicRiskTokenDTO> {
    const art_id = `ART_${uuidv4()}`;
    const now = new Date().toISOString();
    const expires_at = new Date(Date.now() + 30000).toISOString();

    const reason_codes: string[] = [];
    let decision: ARTDecision = ARTDecision.ACCEPT;
    let approved_stake = signal.requested_stake || 25.0;

    const dayCapRemaining = limits.daily_loss_limit_usd - this.dayCapState.current_loss_usd;
    if (dayCapRemaining <= 0) {
      decision = ARTDecision.REJECT;
      approved_stake = 0;
      reason_codes.push('DAYCAP_EXCEEDED');
      this.logger.warn(
        `ART BLOCKED for signal ${signal.signal_id}: DayCap exceeded (${this.dayCapState.current_loss_usd}/${limits.daily_loss_limit_usd})`,
      );
    }

    if (approved_stake > limits.max_lot_per_symbol_usd) {
      if (decision === ARTDecision.ACCEPT) {
        decision = ARTDecision.SCALE_DOWN;
        approved_stake = limits.max_lot_per_symbol_usd;
        reason_codes.push('MAX_LOT_SCALED_DOWN');
        this.logger.warn(
          `ART SCALED DOWN for signal ${signal.signal_id}: Stake ${signal.requested_stake} > max ${limits.max_lot_per_symbol_usd}`,
        );
      }
    }

    if (decision === ARTDecision.ACCEPT || decision === ARTDecision.SCALE_DOWN) {
      this.logger.log(
        `ART ISSUED: ${art_id} for signal ${signal.signal_id}, stake: ${approved_stake}`,
      );
    }

    const artPayload: Omit<AtomicRiskTokenDTO, 'signature'> = {
      art_id,
      signal_id: signal.signal_id,
      user_id: options?.user_id || 'USER_DEFAULT',
      account_id: options?.account_id || 'ACC_DEFAULT',
      profile_id: options?.profile_id || limits.profile_id,
      product: signal.symbol,
      direction: signal.direction,
      decision,
      approved_stake,
      max_risk_amount: approved_stake,
      max_slippage: 2,
      session_drawdown_before: this.dayCapState.current_loss_usd,
      session_drawdown_after: this.dayCapState.current_loss_usd + approved_stake,
      volatility_regime: VolatilityRegime.MEDIUM,
      reason_codes: reason_codes.length > 0 ? reason_codes : undefined,
      expires_at,
      created_at: now,
    };

    const signature = signART(artPayload);

    return {
      ...artPayload,
      signature,
    };
  }
}
