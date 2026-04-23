import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { LiveStrategyPerformance } from '../database/entities/live-strategy-performance.entity';
import { AICoachService } from './ai-coach.service';

export interface DailyInsights {
  generated_at_utc: string;
  window_hours: number;
  totals: {
    signals: number;
    approved: number;
    rejected: number;
    unknown: number;
    approval_rate: number;
  };
  top_symbols: Array<{ symbol: string; count: number }>;
  top_strategies: Array<{ strategy_family: string; count: number; avgConfidence: number }>;
  regime_distribution: Record<string, number>;
  ai_summary: string;
  recommendations: string[];
}

export interface MarketRegimeHeatmap {
  generated_at_utc: string;
  cells: Array<{ symbol: string; timeframe: string; regime: string | null; adx: number | null }>;
  symbols: string[];
  timeframes: string[];
}

export interface StrategyLeaderboardEntry {
  strategy_family: string;
  live_signal_count: number;
  ai_approved_count: number;
  ai_approval_rate: number;
  avg_confidence: number;
  last_seen_utc: string | null;
}

@Injectable()
export class AIInsightsService {
  private readonly logger = new Logger(AIInsightsService.name);
  private cache: { key: string; ts: number; value: any } | null = null;
  private readonly cacheTtlMs = 5 * 60_000;

  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
    @InjectRepository(LiveStrategyPerformance)
    private readonly perfRepo: Repository<LiveStrategyPerformance>,
    private readonly coach: AICoachService,
  ) {}

  async getDailyInsights(windowHours = 24, force = false): Promise<DailyInsights> {
    const key = `daily_${windowHours}`;
    if (!force && this.cache && this.cache.key === key && Date.now() - this.cache.ts < this.cacheTtlMs) {
      return this.cache.value;
    }

    const since = new Date(Date.now() - windowHours * 3600_000);
    const signals = await this.liveSignalRepo.find({
      where: { timestamp_utc: Between(since, new Date()) },
      order: { timestamp_utc: 'DESC' },
      take: 5000,
    });

    const totals = {
      signals: signals.length,
      approved: signals.filter((s) => s.ai_verdict === 'APPROVED').length,
      rejected: signals.filter((s) => s.ai_verdict === 'REJECTED').length,
      unknown: signals.filter((s) => !s.ai_verdict || s.ai_verdict === 'UNKNOWN').length,
      approval_rate: 0,
    };
    const reasonedCount = totals.approved + totals.rejected;
    totals.approval_rate =
      reasonedCount > 0 ? Number((totals.approved / reasonedCount).toFixed(3)) : 0;

    // Top symbols
    const symMap = new Map<string, number>();
    for (const s of signals) symMap.set(s.symbol, (symMap.get(s.symbol) || 0) + 1);
    const top_symbols = Array.from(symMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, count]) => ({ symbol, count }));

    // Top strategies
    const stratMap = new Map<string, { count: number; confSum: number }>();
    for (const s of signals) {
      const key = s.strategy_family || 'unknown';
      const entry = stratMap.get(key) || { count: 0, confSum: 0 };
      entry.count += 1;
      entry.confSum += Number.isFinite(s.confidence_score) ? s.confidence_score : 0;
      stratMap.set(key, entry);
    }
    const top_strategies = Array.from(stratMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([strategy_family, v]) => ({
        strategy_family,
        count: v.count,
        avgConfidence: v.count > 0 ? Number((v.confSum / v.count).toFixed(3)) : 0,
      }));

    // Regime distribution (extracted from notes "Regime: TREND (ADX: ...)")
    const regime_distribution: Record<string, number> = {};
    for (const s of signals) {
      const m = /Regime:\s*([A-Z]+)/.exec(s.notes || '');
      if (m) {
        const r = m[1];
        regime_distribution[r] = (regime_distribution[r] || 0) + 1;
      }
    }

    // Ask the AI to summarise + recommend.
    let ai_summary = '';
    let recommendations: string[] = [];
    if (this.coach.isAvailable()) {
      try {
        const sys =
          'You output ONLY a single valid JSON object. You are the MoonLight daily analyst. ' +
          'Given signal statistics, produce {"summary": string, "recommendations": string[]} in Turkish. ' +
          'summary <= 280 chars. exactly 3 recommendations. No markdown.';
        const payload = JSON.stringify({ totals, top_symbols, top_strategies, regime_distribution });
        const raw = await this.coach.chat(
          [
            { role: 'system', content: sys },
            { role: 'user', content: payload },
          ],
          1200,
        );
        const parsed = this.extractJson(raw);
        if (parsed) {
          ai_summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 400) : '';
          recommendations = Array.isArray(parsed.recommendations)
            ? parsed.recommendations.map((r: any) => String(r)).slice(0, 3)
            : [];
        }
      } catch (err: any) {
        this.logger.warn(`AI daily summary failed: ${err?.message}`);
      }
    }
    if (!ai_summary) {
      ai_summary = `Son ${windowHours} saatte ${totals.signals} sinyal üretildi. AI onay oranı: ${(totals.approval_rate * 100).toFixed(1)}%.`;
    }
    if (!recommendations.length) {
      recommendations = [
        'AI Guard modunu etkinleştirerek düşük kaliteli sinyalleri filtreleyin.',
        'En çok sinyal üreten sembollerin regime dağılımını inceleyin.',
        'Backtest üzerinden en iyi 3 strateji için cool-down ayarlarını kontrol edin.',
      ];
    }

    const value: DailyInsights = {
      generated_at_utc: new Date().toISOString(),
      window_hours: windowHours,
      totals,
      top_symbols,
      top_strategies,
      regime_distribution,
      ai_summary,
      recommendations,
    };
    this.cache = { key, ts: Date.now(), value };
    return value;
  }

  async getRegimeHeatmap(): Promise<MarketRegimeHeatmap> {
    const windowMs = 2 * 3600_000;
    const since = new Date(Date.now() - windowMs);
    const recent = await this.liveSignalRepo.find({
      where: { timestamp_utc: Between(since, new Date()) },
      order: { timestamp_utc: 'DESC' },
      take: 3000,
    });

    const latestByPair = new Map<string, { regime: string | null; adx: number | null; ts: Date }>();
    for (const s of recent) {
      const pair = `${s.symbol}_${s.timeframe}`;
      if (latestByPair.has(pair)) continue;
      const regimeMatch = /Regime:\s*([A-Z]+)/.exec(s.notes || '');
      const adxMatch = /ADX:\s*([\d.]+)/.exec(s.notes || '');
      latestByPair.set(pair, {
        regime: regimeMatch ? regimeMatch[1] : null,
        adx: adxMatch ? parseFloat(adxMatch[1]) : null,
        ts: s.timestamp_utc,
      });
    }

    const symbols = Array.from(new Set(recent.map((s) => s.symbol))).sort();
    const timeframes = Array.from(new Set(recent.map((s) => s.timeframe))).sort(
      (a, b) => this.tfOrder(a) - this.tfOrder(b),
    );
    const cells: MarketRegimeHeatmap['cells'] = [];
    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        const entry = latestByPair.get(`${symbol}_${timeframe}`);
        cells.push({
          symbol,
          timeframe,
          regime: entry?.regime ?? null,
          adx: entry?.adx ?? null,
        });
      }
    }
    return { generated_at_utc: new Date().toISOString(), cells, symbols, timeframes };
  }

  async getStrategyLeaderboard(): Promise<StrategyLeaderboardEntry[]> {
    const since = new Date(Date.now() - 24 * 3600_000);
    const recent = await this.liveSignalRepo.find({
      where: { timestamp_utc: Between(since, new Date()) },
      take: 10_000,
    });

    const map = new Map<
      string,
      {
        count: number;
        approved: number;
        confidenceSum: number;
        lastSeen: Date | null;
      }
    >();
    for (const s of recent) {
      const key = s.strategy_family || 'unknown';
      const e = map.get(key) || { count: 0, approved: 0, confidenceSum: 0, lastSeen: null };
      e.count += 1;
      if (s.ai_verdict === 'APPROVED') e.approved += 1;
      e.confidenceSum += Number.isFinite(s.confidence_score) ? s.confidence_score : 0;
      if (!e.lastSeen || (s.timestamp_utc && s.timestamp_utc > e.lastSeen)) {
        e.lastSeen = s.timestamp_utc;
      }
      map.set(key, e);
    }

    const out: StrategyLeaderboardEntry[] = [];
    for (const [strategy_family, v] of map) {
      out.push({
        strategy_family,
        live_signal_count: v.count,
        ai_approved_count: v.approved,
        ai_approval_rate: v.count > 0 ? Number((v.approved / v.count).toFixed(3)) : 0,
        avg_confidence: v.count > 0 ? Number((v.confidenceSum / v.count).toFixed(3)) : 0,
        last_seen_utc: v.lastSeen ? v.lastSeen.toISOString() : null,
      });
    }
    out.sort((a, b) => b.live_signal_count - a.live_signal_count);
    return out;
  }

  private tfOrder(tf: string): number {
    const map: Record<string, number> = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return map[tf] ?? 999;
  }

  private extractJson(raw: string): any | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
}
