import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { CandleData } from '../data/sources/data-feed.interface';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';
import { StrategyService } from '../strategy/strategy.service';
import { TripleCheckService } from '../risk/triple-check/triple-check.service';
import { EVVetoSlotEngine } from '../strategy/evvetoslot/evvetoslot-engine.service';
import { StrategyContext } from '../shared/dto/strategy-context.dto';
import { OhlcvBarDTO } from '../shared/dto/ohlcv-bar.dto';
import { Environment } from '../shared/dto/canonical-signal.dto';
import { Timeframe } from '../shared/enums/timeframe.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LiveSignalEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveSignalEngine.name);
  private enabled: boolean;
  private candleBuffers: Map<string, OhlcvBarDTO[]> = new Map();
  private signalCount = 0;
  private lastResetTime = Date.now();
  private maxSignalsPerMinute: number;

  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
    private readonly dataFeedOrchestrator: DataFeedOrchestrator,
    private readonly strategyService: StrategyService,
    private readonly tripleCheckService: TripleCheckService,
    private readonly evvetoSlotEngine: EVVetoSlotEngine,
  ) {
    this.enabled = process.env.LIVE_SIGNAL_ENABLED === 'true';
    this.maxSignalsPerMinute = parseInt(
      process.env.LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE || '10',
      10,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Live Signal Engine DISABLED');
      return;
    }

    this.logger.log('Live Signal Engine STARTING with MULTI-PROVIDER support');

    const symbols = (process.env.LIVE_SIGNAL_SYMBOLS || 'XAUUSD,EURUSD').split(',');
    const timeframes = (process.env.LIVE_SIGNAL_TIMEFRAMES || '1m,5m').split(',');

    const adapter = this.dataFeedOrchestrator.getActiveAdapter();

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        await adapter.subscribeToCandles(symbol.trim(), timeframe.trim(), (candle) => {
          this.handleNewCandle(candle);
        });
      }
    }

    this.logger.log(
      `Live Signal Engine ACTIVE: Provider=${this.dataFeedOrchestrator.getActiveProviderName()}, ${symbols.length} symbols x ${timeframes.length} TFs`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    const adapter = this.dataFeedOrchestrator.getActiveAdapter();
    if (adapter.isConnected()) {
      await adapter.disconnect();
    }
  }

  private async handleNewCandle(candle: CandleData): Promise<void> {
    if (!this.checkRateLimit()) {
      this.logger.warn('Signal rate limit exceeded, skipping candle');
      return;
    }

    const key = `${candle.symbol}_${candle.timeframe}`;

    if (!this.candleBuffers.has(key)) {
      this.candleBuffers.set(key, []);
    }

    const buffer = this.candleBuffers.get(key)!;

    const ohlcvBar: OhlcvBarDTO = {
      symbol: candle.symbol,
      tf: candle.timeframe as Timeframe,
      ts_utc: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      source: 'LIVE_FEED',
    };

    buffer.push(ohlcvBar);

    if (buffer.length > 100) {
      buffer.shift();
    }

    try {
      const context: StrategyContext = {
        symbol: candle.symbol,
        tf: candle.timeframe as Timeframe,
        now_ts_utc: candle.timestamp.toISOString(),
        bars: [...buffer],
        environment: Environment.LIVE,
      };

      const signals = await this.strategyService.evaluateStrategiesForContext({
        context,
        options: { max_signals_per_context: 1, min_ev: 0.02, min_confidence: 0.6 },
      });

      for (const signal of signals) {
        const tripleCheckResult = this.tripleCheckService.evaluate({
          data_quality: { quality_grade: 'A' },
        });

        if (tripleCheckResult.level === 'HIGH') {
          this.logger.log(
            `Signal rejected by Triple-Check: ${signal.symbol} (uncertainty: HIGH)`,
          );
          continue;
        }

        const slotResult = this.evvetoSlotEngine.selectSlotForSignal(signal);

        if (slotResult.decision === 'REJECT') {
          this.logger.log(
            `Signal rejected by EVVetoSlot: ${signal.symbol} (${slotResult.reason_codes.join(', ')})`,
          );
          continue;
        }

        const liveSignal = this.liveSignalRepo.create({
          id: `LIVE_${uuidv4()}`,
          timestamp_utc: new Date(signal.ts),
          symbol: signal.symbol,
          timeframe: signal.tf,
          direction: signal.direction,
          signal_horizon: slotResult.selected_expiry_minutes! * 60,
          strategy_family: signal.strategy_id || signal.source,
          confidence_score: signal.confidence_score,
          expected_wr_band_min: signal.ev * 0.9,
          expected_wr_band_max: signal.ev * 1.1,
          environment: 'LIVE_DATA',
          status: 'NEW',
          entry_price: candle.close,
          current_price: candle.close,
        });

        await this.liveSignalRepo.save(liveSignal);

        this.signalCount++;

        this.logger.log(
          `NEW LIVE SIGNAL: ${signal.symbol} ${signal.direction} (confidence: ${signal.confidence_score.toFixed(2)}, slot: ${slotResult.selected_expiry_minutes}m)`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error processing candle for ${key}: ${error?.message || String(error)}`,
      );
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastResetTime;

    if (elapsed >= 60000) {
      this.signalCount = 0;
      this.lastResetTime = now;
    }

    return this.signalCount < this.maxSignalsPerMinute;
  }
}
