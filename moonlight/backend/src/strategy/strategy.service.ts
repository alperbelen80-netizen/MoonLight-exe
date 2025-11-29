import { Injectable, Logger } from '@nestjs/common';
import { CanonicalSignalDTO } from '../shared/dto/canonical-signal.dto';
import { StrategyFactoryService } from './factory/strategy-factory.service';
import { StrategyContext, StrategyEvaluationOptions } from '../shared/dto/strategy-context.dto';
import { StrategyDefinitionDTO } from '../shared/dto/strategy-definition.dto';
import { EVVetoSlotEngine } from './evvetoslot/evvetoslot-engine.service';
import { PackFactoryService } from './pack-factory/pack-factory.service';
import { GatingService } from './gating/gating.service';
import { SlotSelectionResult } from './evvetoslot/evvetoslot.types';

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private readonly strategyFactory: StrategyFactoryService,
    private readonly evvetoSlotEngine: EVVetoSlotEngine,
    private readonly packFactory: PackFactoryService,
    private readonly gatingService: GatingService,
  ) {}

  getStrategyDefinitions(): StrategyDefinitionDTO[] {
    return this.strategyFactory.getAllDefinitions();
  }

  async evaluateStrategiesForContext(params: {
    context: StrategyContext;
    strategyIds?: string[];
    options?: StrategyEvaluationOptions;
  }): Promise<CanonicalSignalDTO[]> {
    const { context, strategyIds, options } = params;

    let strategies = this.strategyFactory.getActiveStrategies();

    if (strategyIds && strategyIds.length > 0) {
      strategies = strategies.filter((s) => strategyIds.includes(s.id));
    }

    const signals: CanonicalSignalDTO[] = [];

    for (const strategy of strategies) {
      try {
        const result = await strategy.evaluate(context);

        if (result === null) {
          continue;
        }

        const resultArray = Array.isArray(result) ? result : [result];

        for (const signal of resultArray) {
          if (options?.min_ev !== undefined && signal.ev < options.min_ev) {
            continue;
          }

          if (
            options?.min_confidence !== undefined &&
            signal.confidence_score < options.min_confidence
          ) {
            continue;
          }

          signals.push(signal);
        }
      } catch (error: any) {
        this.logger.error(
          `Error evaluating strategy ${strategy.id}: ${error?.message || String(error)}`,
        );
      }
    }

    const packResult = this.packFactory.evaluatePackSignals('PACK_DEFAULT', signals);

    const finalSignals: CanonicalSignalDTO[] = [];

    if (packResult.selected_signal) {
      const gatingResult = this.gatingService.selectOne({
        signals: [packResult.selected_signal],
        scores: packResult.scores,
        threshold_delta: 0.01,
      });

      if (gatingResult.selected_signal) {
        finalSignals.push(gatingResult.selected_signal);
      }
    }

    if (
      options?.max_signals_per_context !== undefined &&
      finalSignals.length > options.max_signals_per_context
    ) {
      return finalSignals
        .sort((a, b) => b.ev - a.ev)
        .slice(0, options.max_signals_per_context);
    }

    return finalSignals;
  }

  getOptimizedExpiryForSignal(
    signal: CanonicalSignalDTO,
  ): SlotSelectionResult {
    return this.evvetoSlotEngine.selectSlotForSignal(signal);
  }
}
