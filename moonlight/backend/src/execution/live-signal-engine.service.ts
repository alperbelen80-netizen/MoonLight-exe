import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { CandleData } from '../data/sources/data-feed.interface';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';
import { StrategyService } from '../strategy/strategy.service';
import { TripleCheckService } from '../risk/triple-check/triple-check.service';
import { EVVetoSlotEngine } from '../strategy/evvetoslot/evvetoslot-engine.service';
import { RegimeDetectorService } from '../data/regime-detector.service';
import { LiveStrategyPerformanceService } from '../strategy/live-strategy-performance.service';
import { StrategyContext } from '../shared/dto/strategy-context.dto';
import { OhlcvBarDTO } from '../shared/dto/ohlcv-bar.dto';
import { Environment } from '../shared/dto/canonical-signal.dto';
import { Timeframe } from '../shared/enums/timeframe.enum';
import { MarketRegime } from '../shared/enums/market-regime.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LiveSignalEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveSignalEngine.name);
  private enabled: boolean;
  private candleBuffers: Map<string, OhlcvBarDTO[]> = new Map();
  private regimeCache: Map<string, { regime: MarketRegime; timestamp: Date }> = new Map();
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
    private readonly regimeDetector: RegimeDetectorService,
    private readonly strategyPerformance: LiveStrategyPerformanceService,
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

    this.logger.log('Live Signal Engine STARTING with REGIME DETECTION');

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
      `Live Signal Engine ACTIVE: ${symbols.length} symbols x ${timeframes.length} TFs`,
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

    const regimeResult = this.regimeDetector.detectRegime([...buffer]);
    this.regimeCache.set(key, {
      regime: regimeResult.regime,
      timestamp: regimeResult.timestamp,
    });

    if (regimeResult.regime === MarketRegime.SHOCK) {
      this.logger.warn(
        `SHOCK regime detected for ${key}, skipping signal generation`,
      );
      return;
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
        const strategyCategory =
          signal.strategy_id?.includes('trend')
            ? 'trend_follow'
            : signal.strategy_id?.includes('revert')
            ? 'mean_revert'
            : 'scalping';

        const isSuitable = this.regimeDetector.classifyRegimeForStrategy(
          regimeResult.regime,
          strategyCategory,
        );

        if (!isSuitable) {
          this.logger.log(
            `Strategy ${signal.strategy_id} not suitable for ${regimeResult.regime}, skipping`,
          );
          continue;
        }

        const tripleCheckResult = this.tripleCheckService.evaluate({
          data_quality: { quality_grade: 'A' },
        });

        if (tripleCheckResult.level === 'HIGH') {
          continue;
        }

        const slotResult = await this.evvetoSlotEngine.selectSlotForSignal(signal);

        if (slotResult.decision === 'REJECT') {
          continue;
        }

        await this.strategyPerformance.recordSignal(
          signal.strategy_id || signal.source,
          signal.confidence_score,
        );

        // Defensive numeric normalization – signal.ev / confidence_score
        // may occasionally arrive as undefined / NaN from legacy packs.
        const safeNum = (v: any, fallback = 0): number =>
          typeof v === 'number' && Number.isFinite(v) ? v : fallback;
        const safeEv = safeNum(signal.ev, 0);
        const safeConf = safeNum(signal.confidence_score, 0.6);
        const safeClose = safeNum(candle.close, 0);
        const signalTs = (() => {
          const d = signal.ts ? new Date(signal.ts) : new Date();
          return Number.isFinite(d.getTime()) ? d : new Date();
        })();
        const expiryMin = safeNum(slotResult.selected_expiry_minutes, 1);

        const liveSignal = this.liveSignalRepo.create({
          id: `LIVE_${uuidv4()}`,
          timestamp_utc: signalTs,
          symbol: signal.symbol,
          timeframe: signal.tf,
          direction: signal.direction,
          signal_horizon: Math.round(expiryMin * 60),
          strategy_family: signal.strategy_id || signal.source,
          confidence_score: safeConf,
          expected_wr_band_min: safeEv * 0.9,
          expected_wr_band_max: safeEv * 1.1,
          environment: 'LIVE_DATA',
          status: 'NEW',
          entry_price: safeClose,
          current_price: safeClose,
          notes: `Regime: ${regimeResult.regime} (ADX: ${regimeResult.adx.toFixed(1)})`,
        });

        await this.liveSignalRepo.save(liveSignal);

        this.signalCount++;

        this.logger.log(
          `NEW SIGNAL: ${signal.symbol} ${signal.direction} | Regime: ${regimeResult.regime} | ADX: ${regimeResult.adx.toFixed(1)}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error processing candle: ${error?.message}`);
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

  getCurrentRegime(symbol: string, timeframe: string): MarketRegime | null {
    const key = `${symbol}_${timeframe}`;
    const cached = this.regimeCache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp.getTime();
    if (age > 300000) {
      return null;
    }

    return cached.regime;
  }
}
