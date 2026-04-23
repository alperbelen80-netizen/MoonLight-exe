import { Injectable, Logger } from '@nestjs/common';
import { AICoachService } from '../ai-coach/ai-coach.service';

export interface BacktestStatsInput {
  runId: string;
  environment?: string;
  symbols?: string[];
  timeframes?: string[];
  total_trades?: number;
  net_pnl?: number;
  win_rate?: number;
  max_drawdown?: number;
  avg_trade_pnl?: number;
  profit_factor?: number;
  sharpe?: number;
  per_strategy?: Array<{ strategy: string; trades: number; win_rate: number; pnl: number }>;
}

export interface BacktestAIAnalysis {
  runId: string;
  strengths: string[];
  weaknesses: string[];
  regimeFit: string;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  suggestedParameterBands: Array<{ param: string; min: number | string; max: number | string; note?: string }>;
  raw: string;
  model: string;
}

/**
 * Backtest AI Analyzer (v1.9)
 *
 * Wraps Gemini to turn raw backtest stats into actionable insights.
 * Degrades gracefully when the LLM is unavailable (returns a
 * deterministic skeleton analysis derived from the numbers).
 */
@Injectable()
export class BacktestAIAnalyzerService {
  private readonly logger = new Logger(BacktestAIAnalyzerService.name);

  constructor(private readonly coach: AICoachService) {}

  async analyze(stats: BacktestStatsInput): Promise<BacktestAIAnalysis> {
    const fallback = this.deterministicFallback(stats);
    if (!this.coach.isAvailable()) {
      return fallback;
    }
    const sys =
      'Return ONLY one JSON object. Turkish. No markdown. ' +
      'Schema: {"strengths":string[],"weaknesses":string[],"regimeFit":string,"recommendations":string[],"riskLevel":"low"|"medium"|"high","suggestedParameterBands":[{"param":string,"min":number|string,"max":number|string,"note":string}]}. ' +
      'strengths/weaknesses/recommendations <=4 items each, <=120 chars each. suggestedParameterBands <=4 items.';
    const payload = JSON.stringify(stats);
    let raw = '';
    try {
      raw = await this.coach.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: payload },
        ],
        2500,
      );
    } catch (err: any) {
      this.logger.warn(`BacktestAI analyze failed, using fallback: ${err?.message}`);
      return { ...fallback, raw: err?.message || '' };
    }
    const parsed = this.extractJson(raw);
    if (!parsed) {
      return { ...fallback, raw };
    }
    return {
      runId: stats.runId,
      strengths: this.asStringArray(parsed.strengths, 4),
      weaknesses: this.asStringArray(parsed.weaknesses, 4),
      regimeFit: typeof parsed.regimeFit === 'string' ? parsed.regimeFit.slice(0, 200) : fallback.regimeFit,
      recommendations: this.asStringArray(parsed.recommendations, 4),
      riskLevel: this.asRiskLevel(parsed.riskLevel, fallback.riskLevel),
      suggestedParameterBands: Array.isArray(parsed.suggestedParameterBands)
        ? parsed.suggestedParameterBands.slice(0, 4).map((b: any) => ({
            param: String(b?.param ?? ''),
            min: b?.min ?? '',
            max: b?.max ?? '',
            note: typeof b?.note === 'string' ? b.note.slice(0, 160) : undefined,
          }))
        : [],
      raw,
      model: this.coach.getModelName(),
    };
  }

  private deterministicFallback(stats: BacktestStatsInput): BacktestAIAnalysis {
    const wr = stats.win_rate ?? 0;
    const pf = stats.profit_factor ?? 0;
    const dd = stats.max_drawdown ?? 0;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (wr >= 0.55) strengths.push(`Kazanç oranı %${(wr * 100).toFixed(1)} ile istikrarlı.`);
    if (pf >= 1.3) strengths.push(`Profit factor ${pf.toFixed(2)} kıymetli edge gösteriyor.`);
    if (wr < 0.45) weaknesses.push(`Düşük win rate (%${(wr * 100).toFixed(1)}).`);
    if (dd > 0.2) weaknesses.push(`Yüksek max drawdown (%${(dd * 100).toFixed(1)}).`);
    if (pf && pf < 1) weaknesses.push(`Profit factor 1'in altında; zararlı sistem.`);
    if (strengths.length === 0) strengths.push('Kıyı sonuçları — belirgin güç yok.');
    if (weaknesses.length === 0) weaknesses.push('Dikkat çeken kritik zayıflık yok.');
    const risk: 'low' | 'medium' | 'high' = dd > 0.3 || (pf && pf < 1) ? 'high' : dd > 0.15 ? 'medium' : 'low';
    return {
      runId: stats.runId,
      strengths,
      weaknesses,
      regimeFit:
        (stats.symbols || []).length > 1
          ? 'Karma sembol sepeti — rejim uyumu sembole göre ayrı incelenmeli.'
          : 'Tek sembol — rejim uyumu deterministik.',
      recommendations: [
        'Cool-down ve cap’leri gerilen drawdown dönemlerinde sıkılaştırın.',
        'Per-strategy breakdown’ın alt %20’sini aynı çalışma için devre dışı bırakmayı deneyin.',
        'Regime filter ekleyerek düşük ADX periyodlarında işlem sayısını azaltın.',
      ],
      riskLevel: risk,
      suggestedParameterBands: [],
      raw: '',
      model: 'deterministic-fallback',
    };
  }

  private asStringArray(v: any, max: number): string[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => String(x))
      .map((s) => s.slice(0, 240))
      .slice(0, max);
  }

  private asRiskLevel(v: any, fb: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
    return v === 'low' || v === 'medium' || v === 'high' ? v : fb;
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
