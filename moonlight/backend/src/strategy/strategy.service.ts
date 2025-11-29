import { Injectable, Logger } from '@nestjs/common';
import { StrategyFactoryService } from './factory/strategy-factory.service';
import { CanonicalSignalDTO } from '../shared/dto/canonical-signal.dto';
import { StrategyContext, StrategyEvaluationOptions } from '../shared/dto/strategy-context.dto';
import { StrategyDefinitionDTO } from '../shared/dto/strategy-definition.dto';

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(private readonly strategyFactory: StrategyFactoryService) {}

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

    if (
      options?.max_signals_per_context !== undefined &&
      signals.length > options.max_signals_per_context
    ) {
      return signals
        .sort((a, b) => b.ev - a.ev)
        .slice(0, options.max_signals_per_context);
    }

    return signals;
  }
}
