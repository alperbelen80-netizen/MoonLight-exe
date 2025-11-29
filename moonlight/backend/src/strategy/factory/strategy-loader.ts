import { PresetStrategyDTO } from '../../shared/dto/preset-strategy.dto';
import { StrategyInstance } from './strategy-factory.service';
import { IndicatorService } from '../indicators/indicator.service';
import { StrategyContext } from '../../shared/dto/strategy-context.dto';
import { CanonicalSignalDTO, SignalDirection } from '../../shared/dto/canonical-signal.dto';
import { v4 as uuidv4 } from 'uuid';

export function createStrategyInstanceFromDescriptor(
  descriptor: PresetStrategyDTO,
  indicatorService: IndicatorService,
): StrategyInstance {
  const instance: StrategyInstance = {
    id: descriptor.id,
    definition: {
      id: descriptor.id,
      name: descriptor.name,
      description: `Preset: ${descriptor.name}`,
      category: descriptor.category,
      version: descriptor.version,
      parameters: [],
      allowed_timeframes: descriptor.timeframes,
      allowed_symbols: descriptor.symbols,
      tags: descriptor.tags,
    },
    evaluate: async (context: StrategyContext) => {
      const { entry, risk } = descriptor;

      let conditionsMet = false;

      if (entry.conditions_mode === 'ALL') {
        conditionsMet = entry.conditions.every((cond) =>
          evaluateCondition(cond, context, indicatorService),
        );
      } else {
        conditionsMet = entry.conditions.some((cond) =>
          evaluateCondition(cond, context, indicatorService),
        );
      }

      if (!conditionsMet) {
        return null;
      }

      const signal: CanonicalSignalDTO = {
        signal_id: `SIG_${uuidv4()}`,
        idempotency_key: `${context.symbol}_${context.now_ts_utc}_${descriptor.id}`,
        source: descriptor.id,
        strategy_id: descriptor.id,
        symbol: context.symbol,
        tf: context.tf,
        ts: context.now_ts_utc,
        direction: entry.direction,
        ev: risk.min_ev,
        confidence_score: risk.min_confidence,
        valid_until: new Date(Date.now() + 60000).toISOString(),
        latency_budget_ms: 200,
        schema_version: 1,
        environment: context.environment,
      };

      return signal;
    },
  };

  return instance;
}

function evaluateCondition(
  cond: any,
  context: StrategyContext,
  indicatorService: IndicatorService,
): boolean {
  const { indicator, period, operator, value } = cond;

  if (indicator === 'RSI' && period) {
    const rsi = indicatorService.calculateRSI(context.bars, period);
    if (!rsi) return false;
    return compareValues(rsi.value, operator, value);
  }

  if (indicator === 'BB' && period) {
    const bb = indicatorService.calculateBB(context.bars, period, 2.0);
    if (!bb) return false;
    const lastClose = context.bars[context.bars.length - 1].close;
    return compareValues(lastClose, operator, value || bb.lower);
  }

  return false;
}

function compareValues(a: number, operator: string | undefined, b: number | undefined): boolean {
  if (b === undefined) return false;
  if (operator === '<') return a < b;
  if (operator === '<=') return a <= b;
  if (operator === '>') return a > b;
  if (operator === '>=') return a >= b;
  if (operator === '==') return a === b;
  if (operator === '!=') return a !== b;
  return false;
}
