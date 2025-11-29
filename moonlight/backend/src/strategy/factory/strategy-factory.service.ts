import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StrategyDefinitionDTO } from '../../shared/dto/strategy-definition.dto';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import { StrategyContext } from '../../shared/dto/strategy-context.dto';
import { IndicatorService } from '../indicators/indicator.service';
import { v4 as uuidv4 } from 'uuid';

export interface StrategyInstance {
  id: string;
  definition: StrategyDefinitionDTO;
  evaluate(
    context: StrategyContext,
  ): Promise<CanonicalSignalDTO[] | CanonicalSignalDTO | null>;
}

@Injectable()
export class StrategyFactoryService implements OnModuleInit {
  private readonly logger = new Logger(StrategyFactoryService.name);
  private strategies: Map<string, StrategyInstance> = new Map();

  constructor(private readonly indicatorService: IndicatorService) {}

  onModuleInit(): void {
    this.registerBuiltInStrategies();
  }

  private registerBuiltInStrategies(): void {
    const bbRsiBuyStrategy: StrategyInstance = {
      id: 'bb_rsi_buy_v1',
      definition: {
        id: 'bb_rsi_buy_v1',
        name: 'BB + RSI Buy Signal',
        description: 'Bollinger Bands squeeze + RSI oversold',
        category: 'scalping',
        version: 1,
        parameters: [],
        allowed_timeframes: ['1m', '5m'] as any,
        tags: ['bb', 'rsi'],
      },
      evaluate: async (context) => {
        const bb = this.indicatorService.calculateBB(context.bars, 20, 2.0);
        const rsi = this.indicatorService.calculateRSI(context.bars, 14);

        if (!bb || !rsi) {
          return null;
        }

        const lastClose = context.bars[context.bars.length - 1].close;

        if (lastClose < bb.lower && rsi.value < 30) {
          const signal: CanonicalSignalDTO = {
            signal_id: `SIG_${uuidv4()}`,
            idempotency_key: `${context.symbol}_${context.now_ts_utc}_bb_rsi_buy`,
            source: 'bb_rsi_buy_v1',
            strategy_id: 'bb_rsi_buy_v1',
            symbol: context.symbol,
            tf: context.tf,
            ts: context.now_ts_utc,
            direction: 'CALL' as any,
            ev: 0.05,
            confidence_score: 0.7,
            valid_until: new Date(Date.now() + 60000).toISOString(),
            latency_budget_ms: 200,
            schema_version: 1,
            environment: context.environment,
          };
          return signal;
        }

        return null;
      },
    };

    const bbRsiSellStrategy: StrategyInstance = {
      id: 'bb_rsi_sell_v1',
      definition: {
        id: 'bb_rsi_sell_v1',
        name: 'BB + RSI Sell Signal',
        description: 'Bollinger Bands squeeze + RSI overbought',
        category: 'scalping',
        version: 1,
        parameters: [],
        allowed_timeframes: ['1m', '5m'] as any,
        tags: ['bb', 'rsi'],
      },
      evaluate: async (context) => {
        const bb = this.indicatorService.calculateBB(context.bars, 20, 2.0);
        const rsi = this.indicatorService.calculateRSI(context.bars, 14);

        if (!bb || !rsi) {
          return null;
        }

        const lastClose = context.bars[context.bars.length - 1].close;

        if (lastClose > bb.upper && rsi.value > 70) {
          const signal: CanonicalSignalDTO = {
            signal_id: `SIG_${uuidv4()}`,
            idempotency_key: `${context.symbol}_${context.now_ts_utc}_bb_rsi_sell`,
            source: 'bb_rsi_sell_v1',
            strategy_id: 'bb_rsi_sell_v1',
            symbol: context.symbol,
            tf: context.tf,
            ts: context.now_ts_utc,
            direction: 'PUT' as any,
            ev: 0.05,
            confidence_score: 0.7,
            valid_until: new Date(Date.now() + 60000).toISOString(),
            latency_budget_ms: 200,
            schema_version: 1,
            environment: context.environment,
          };
          return signal;
        }

        return null;
      },
    };

    this.registerStrategy(bbRsiBuyStrategy);
    this.registerStrategy(bbRsiSellStrategy);
  }

  registerStrategy(instance: StrategyInstance): void {
    if (this.strategies.has(instance.id)) {
      this.logger.warn(
        `Strategy ${instance.id} already registered, overwriting`,
      );
    }
    this.strategies.set(instance.id, instance);
    this.logger.log(`Registered strategy: ${instance.id}`);
  }

  getAllDefinitions(): StrategyDefinitionDTO[] {
    return Array.from(this.strategies.values()).map((s) => s.definition);
  }

  getStrategy(id: string): StrategyInstance | undefined {
    return this.strategies.get(id);
  }

  getActiveStrategies(): StrategyInstance[] {
    return Array.from(this.strategies.values());
  }
}
