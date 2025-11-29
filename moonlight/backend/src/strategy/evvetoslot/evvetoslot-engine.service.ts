import { Injectable, Logger } from '@nestjs/common';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import {
  SlotSelectionResult,
  SlotDecision,
  SlotEvaluationContext,
} from './evvetoslot.types';
import { DEFAULT_SLOT_CONFIG, MOCK_PAYOUT_MATRIX, SlotConfig } from './evvetoslot.config';

@Injectable()
export class EVVetoSlotEngine {
  private readonly logger = new Logger(EVVetoSlotEngine.name);
  private config: SlotConfig = DEFAULT_SLOT_CONFIG;

  selectSlotForSignal(signal: CanonicalSignalDTO): SlotSelectionResult {
    const { ev, confidence_score } = signal;

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
      const payoutRatio = MOCK_PAYOUT_MATRIX[slotMinutes] || 0.85;

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
      `Selected slot ${best.slot}m for signal ${signal.signal_id}: EV=${best.ev.toFixed(4)}, Payout=${best.payout}`,
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
