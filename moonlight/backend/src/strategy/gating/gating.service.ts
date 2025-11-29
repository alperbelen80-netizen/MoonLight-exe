import { Injectable, Logger } from '@nestjs/common';
import { GatingContext, GatingResult, GatingDecision } from './gating.types';

@Injectable()
export class GatingService {
  private readonly logger = new Logger(GatingService.name);

  selectOne(context: GatingContext): GatingResult {
    const { signals, scores, threshold_delta } = context;

    if (signals.length === 0) {
      return {
        decision: GatingDecision.REJECT_ALL,
        selected_signal: null,
        reason_codes: ['NO_SIGNALS'],
      };
    }

    if (signals.length === 1) {
      return {
        decision: GatingDecision.SELECT_ONE,
        selected_signal: signals[0],
        reason_codes: [],
      };
    }

    const sorted = signals
      .map((s) => ({ signal: s, score: scores[s.signal_id] || 0 }))
      .sort((a, b) => b.score - a.score);

    const best = sorted[0];
    const second = sorted[1];

    const delta = best.score - second.score;

    if (delta < threshold_delta) {
      this.logger.warn(
        `Gating REJECT_ALL: top scores too close (delta: ${delta.toFixed(4)} < ${threshold_delta})`,
      );

      return {
        decision: GatingDecision.REJECT_ALL,
        selected_signal: null,
        reason_codes: ['SCORES_TOO_CLOSE'],
      };
    }

    this.logger.log(
      `Gating selected signal ${best.signal.signal_id} with score ${best.score.toFixed(4)}`,
    );

    return {
      decision: GatingDecision.SELECT_ONE,
      selected_signal: best.signal,
      reason_codes: [],
    };
  }
}
