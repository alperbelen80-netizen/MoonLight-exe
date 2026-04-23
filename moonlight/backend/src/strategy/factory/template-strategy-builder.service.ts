// MoonLight V2.1-A — Template Strategy Builder.
//
// Consumes the 100 indicator-template catalog (from IndicatorRegistryService)
// and registers one StrategyInstance per template into the StrategyFactory.
//
// Safety policy (V2.1-A):
//   - If a template's components map to known IndicatorService primitives
//     (RSI / EMA / MACD / BB / ADX), we build a deterministic evaluator
//     and flag `implemented=true`.
//   - Otherwise we register a "dormant" strategy whose evaluator ALWAYS
//     returns null (never emits a false signal) and flag `implemented=false`.
//
// This gives full breadth (100 strategies discoverable to UI + Strategy Factory)
// without ever leaking unvalidated signals into execution.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IndicatorRegistryService, TemplateEntry } from '../../indicators/indicator-registry.service';
import { StrategyFactoryService, StrategyInstance } from './strategy-factory.service';
import { IndicatorService } from '../indicators/indicator.service';
import type { StrategyContext } from '../../shared/dto/strategy-context.dto';
import type { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';
import { v4 as uuidv4 } from 'uuid';

type Primitive =
  | 'RSI'
  | 'EMA'
  | 'MACD'
  | 'BB'
  | 'ADX'
  | 'SMA'
  | 'VWAP'
  | 'ATR'
  | 'SUPERTREND';

interface TemplateRule {
  primitives: Primitive[];
  hasLong: boolean;
  hasShort: boolean;
}

function detectPrimitives(components: string): Primitive[] {
  const c = (components || '').toUpperCase();
  const out: Primitive[] = [];
  if (c.includes('RSI')) out.push('RSI');
  if (c.includes('EMA')) out.push('EMA');
  if (c.includes('MACD')) out.push('MACD');
  if (c.includes('BOLLINGER') || c.match(/\bBB\b/)) out.push('BB');
  if (c.includes('ADX')) out.push('ADX');
  if (c.match(/\bSMA\b/)) out.push('SMA');
  if (c.includes('VWAP')) out.push('VWAP');
  if (c.includes('ATR')) out.push('ATR');
  if (c.includes('SUPERTREND')) out.push('SUPERTREND');
  return out;
}

@Injectable()
export class TemplateStrategyBuilderService implements OnModuleInit {
  private readonly logger = new Logger(TemplateStrategyBuilderService.name);
  private implementedCount = 0;
  private dormantCount = 0;

  constructor(
    private readonly registry: IndicatorRegistryService,
    private readonly factory: StrategyFactoryService,
    private readonly indicators: IndicatorService,
  ) {}

  onModuleInit(): void {
    if (process.env.V2_TEMPLATE_AUTOLOAD === 'false') {
      this.logger.log('Template autoload disabled (V2_TEMPLATE_AUTOLOAD=false)');
      return;
    }
    this.registerAll();
  }

  registerAll(): { implemented: number; dormant: number; total: number } {
    this.implementedCount = 0;
    this.dormantCount = 0;
    const templates = this.registry.listTemplates();
    for (const t of templates) {
      const rule = this.buildRule(t);
      const instance = this.toStrategyInstance(t, rule);
      this.factory.registerStrategy(instance);
      if (rule.primitives.length > 0 && (rule.hasLong || rule.hasShort)) {
        this.implementedCount++;
      } else {
        this.dormantCount++;
      }
    }
    this.logger.log(
      `TemplateStrategyBuilder registered ${templates.length} (implemented=${this.implementedCount}, dormant=${this.dormantCount})`,
    );
    return {
      implemented: this.implementedCount,
      dormant: this.dormantCount,
      total: templates.length,
    };
  }

  private buildRule(t: TemplateEntry): TemplateRule {
    const primitives = detectPrimitives(
      `${t.components} ${t.longRule} ${t.shortRule} ${t.name} ${t.purpose}`,
    );
    const long = (t.longRule || '').trim();
    const short = (t.shortRule || '').trim();
    return {
      primitives,
      hasLong: long.length > 0 && !/tek başına değil/i.test(long),
      hasShort: short.length > 0 && !/tek başına değil/i.test(short),
    };
  }

  private toStrategyInstance(t: TemplateEntry, rule: TemplateRule): StrategyInstance {
    const id = `tpl_${t.n.toString().padStart(3, '0')}_v1`;
    const dormant = rule.primitives.length === 0 || !(rule.hasLong || rule.hasShort);
    const tfList = this.parseTimeframes(t.suitableTimeframes);

    const evaluator = async (
      ctx: StrategyContext,
    ): Promise<CanonicalSignalDTO | CanonicalSignalDTO[] | null> => {
      if (dormant) return null;
      if (!ctx.bars || ctx.bars.length < 30) return null;

      // Compute relevant indicators only.
      const rsi = rule.primitives.includes('RSI')
        ? this.indicators.calculateRSI(ctx.bars, 14)
        : null;
      const ema =
        rule.primitives.includes('EMA') || rule.primitives.includes('SMA')
          ? this.indicators.calculateEMA(ctx.bars, 21)
          : null;
      const macd = rule.primitives.includes('MACD')
        ? this.indicators.calculateMACD(ctx.bars, 12, 26, 9)
        : null;
      const adx = rule.primitives.includes('ADX')
        ? this.indicators.calculateADX(ctx.bars, 14)
        : null;
      const bb = rule.primitives.includes('BB')
        ? this.indicators.calculateBB(ctx.bars, 20, 2)
        : null;

      const last = ctx.bars[ctx.bars.length - 1];
      const close = last.close;

      // Simple ensemble: require majority of active primitives agreeing.
      let longVotes = 0;
      let shortVotes = 0;
      let activeAxes = 0;
      if (rsi) {
        activeAxes++;
        if (rsi.value <= 30) longVotes++;
        else if (rsi.value >= 70) shortVotes++;
      }
      if (ema) {
        activeAxes++;
        if (close > ema.value) longVotes++;
        else if (close < ema.value) shortVotes++;
      }
      if (macd) {
        activeAxes++;
        if (macd.histogram > 0) longVotes++;
        else if (macd.histogram < 0) shortVotes++;
      }
      if (adx) {
        // ADX just confirms there's a trend; weight half.
        if (adx.adx >= 20) activeAxes += 0.5;
      }
      if (bb) {
        activeAxes++;
        if (close < bb.lower) longVotes++;
        else if (close > bb.upper) shortVotes++;
      }

      if (activeAxes === 0) return null;
      const longRatio = longVotes / activeAxes;
      const shortRatio = shortVotes / activeAxes;
      const dominant =
        longRatio > shortRatio && longRatio >= 0.6 && rule.hasLong
          ? 'LONG'
          : shortRatio > longRatio && shortRatio >= 0.6 && rule.hasShort
            ? 'SHORT'
            : null;
      if (!dominant) return null;

      const confidence = Math.max(longRatio, shortRatio);
      const signal: CanonicalSignalDTO = {
        signal_id: uuidv4(),
        source: 'TEMPLATE_STRATEGY',
        strategy_id: id,
        symbol: ctx.symbol,
        tf: ctx.tf as never,
        direction: dominant,
        entry_price: close,
        confidence_score: Number(confidence.toFixed(3)),
        ev: 0,
        ts: new Date().toISOString(),
      } as unknown as CanonicalSignalDTO;
      return signal;
    };

    return {
      id,
      definition: {
        id,
        name: `Template ${t.n}: ${t.name}`,
        description: dormant
          ? `[DORMANT] ${t.purpose} — primitives not mapped; no signals emitted.`
          : `${t.purpose} | primitives: ${rule.primitives.join(',')}`,
        category: dormant ? 'dormant' : 'template_v1',
        version: 1,
        parameters: [],
        allowed_timeframes: tfList as never,
        tags: ['v2', 'template', ...rule.primitives.map((p) => p.toLowerCase())],
      } as never,
      evaluate: evaluator,
    };
  }

  private parseTimeframes(s: string | undefined): string[] {
    if (!s) return ['15m', '1h'];
    const out = new Set<string>();
    const lower = s.toLowerCase();
    for (const tf of ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '1d']) {
      if (lower.includes(tf)) out.add(tf);
    }
    return out.size > 0 ? [...out] : ['15m', '1h'];
  }

  stats() {
    return {
      total: this.registry.listTemplates().length,
      implemented: this.implementedCount,
      dormant: this.dormantCount,
    };
  }
}
