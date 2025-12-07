import { Injectable, Logger } from '@nestjs/common';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import {
  SlotSelectionResult,
  SlotDecision,
} from './evvetoslot.types';
import { DEFAULT_SLOT_CONFIG, SlotConfig } from './evvetoslot.config';
import { PayoutMatrixService } from '../../broker/payout/payout-matrix.service';

@Injectable()
export class EVVetoSlotEngine {
  private readonly logger = new Logger(EVVetoSlotEngine.name);
  private config: SlotConfig = DEFAULT_SLOT_CONFIG;

  constructor(private readonly payoutMatrix: PayoutMatrixService) {}

  async selectSlotForSignal(signal: CanonicalSignalDTO): Promise<SlotSelectionResult> {
    const { ev, confidence_score, symbol } = signal;

    if (ev < this.config.min_ev) {
      return {
        decision: SlotDecision.REJECT,
        selected_expiry_minutes: null,
        expected_ev: 0,
        effective_payout_ratio: 0,
        reason_codes: ['EV_TOO_LOW'],
      };
    }

    if (confidence_score < this.config.min_confidence) {
      return {
        decision: SlotDecision.REJECT,
        selected_expiry_minutes: null,
        expected_ev: 0,
        effective_payout_ratio: 0,
        reason_codes: ['CONFIDENCE_TOO_LOW'],
      };
    }

    const eligibleSlots: {
      slot: number;
      ev: number;
      payout: number;
    }[] = [];

    for (const slotMinutes of this.config.allowed_slots_minutes) {
      const payoutData = await this.payoutMatrix.getPayoutForSlot(symbol, slotMinutes);
      const payoutRatio = payoutData?.payout_ratio || 0.85;

      if (payoutRatio < this.config.min_payout_ratio) {
        continue;
      }

      const effectiveEV = ev * payoutRatio * this.config.reliability_factor;

      eligibleSlots.push({
        slot: slotMinutes,
        ev: effectiveEV,
        payout: payoutRatio,
      });
    }

    if (eligibleSlots.length === 0) {
      return {
        decision: SlotDecision.REJECT,
        selected_expiry_minutes: null,
        expected_ev: 0,
        effective_payout_ratio: 0,
        reason_codes: ['NO_ELIGIBLE_SLOTS'],
      };
    }

    eligibleSlots.sort((a, b) => b.ev - a.ev);

    const best = eligibleSlots[0];

    this.logger.log(
      `Selected slot ${best.slot}m for ${symbol}: EV=${best.ev.toFixed(4)}, Payout=${(best.payout * 100).toFixed(1)}% (source: ${await this.payoutMatrix.getActiveProvider()})`,
    );

    return {
      decision: SlotDecision.ACCEPT,
      selected_expiry_minutes: best.slot,
      expected_ev: best.ev,
      effective_payout_ratio: best.payout,
      reason_codes: [],
    };
  }
}
