import { Injectable, Logger } from '@nestjs/common';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import { PackDefinition, PackDecisionResult } from './pack.types';

const DEFAULT_PACK: PackDefinition = {
  id: 'PACK_DEFAULT',
  name: 'Default Strategy Pack',
  strategy_ids: ['bb_rsi_buy_v1', 'bb_rsi_sell_v1'],
  weights: {
    bb_rsi_buy_v1: 0.6,
    bb_rsi_sell_v1: 0.4,
  },
  min_agreement: 0.5,
};

@Injectable()
export class PackFactoryService {
  private readonly logger = new Logger(PackFactoryService.name);
  private packs: Map<string, PackDefinition> = new Map();

  constructor() {
    this.packs.set(DEFAULT_PACK.id, DEFAULT_PACK);
  }

  getPackDefinitions(): PackDefinition[] {
    return Array.from(this.packs.values());
  }

  evaluatePackSignals(
    packId: string,
    signals: CanonicalSignalDTO[],
  ): PackDecisionResult {
    const pack = this.packs.get(packId);

    if (!pack) {
      return {
        pack_id: packId,
        selected_signal: null,
        reason_codes: ['PACK_NOT_FOUND'],
        scores: {},
      };
    }

    if (signals.length === 0) {
      return {
        pack_id: packId,
        selected_signal: null,
        reason_codes: ['NO_SIGNALS'],
        scores: {},
      };
    }

    const scores: Record<string, number> = {};

    signals.forEach((signal) => {
      const strategyId = signal.strategy_id || signal.source;
      const weight = pack.weights[strategyId] || 0;
      const score = signal.ev * signal.confidence_score * weight;
      scores[signal.signal_id] = score;
    });

    const sorted = signals
      .map((s) => ({ signal: s, score: scores[s.signal_id] }))
      .sort((a, b) => b.score - a.score);

    const best = sorted[0];

    this.logger.log(
      `Pack ${packId} selected signal ${best.signal.signal_id} with score ${best.score.toFixed(4)}`,
    );

    return {
      pack_id: packId,
      selected_signal: best.signal,
      reason_codes: [],
      scores,
    };
  }
}
