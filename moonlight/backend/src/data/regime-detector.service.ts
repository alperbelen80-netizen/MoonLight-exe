import { Injectable, Logger } from '@nestjs/common';
import { OhlcvBarDTO } from '../shared/dto/ohlcv-bar.dto';
import { MarketRegime, RegimeDetectionResult } from '../shared/enums/market-regime.enum';
import { IndicatorService } from '../strategy/indicators/indicator.service';

@Injectable()
export class RegimeDetectorService {
  private readonly logger = new Logger(RegimeDetectorService.name);

  private readonly ADX_TREND_THRESHOLD = 25;
  private readonly ADX_STRONG_TREND_THRESHOLD = 35;
  private readonly VOLATILITY_SHOCK_THRESHOLD = 0.03;
  private readonly VOLATILITY_PERIOD = 14;

  constructor(private readonly indicatorService: IndicatorService) {}

  detectRegime(bars: OhlcvBarDTO[]): RegimeDetectionResult {
    if (bars.length < 30) {
      return {
        regime: MarketRegime.UNKNOWN,
        confidence: 0,
        adx: 0,
        volatility: 0,
        timestamp: new Date(),
      };
    }

    const adxResult = this.indicatorService.calculateADX(bars, 14);
    const volatility = this.calculateVolatility(bars, this.VOLATILITY_PERIOD);

    if (!adxResult) {
      return {
        regime: MarketRegime.UNKNOWN,
        confidence: 0,
        adx: 0,
        volatility,
        timestamp: new Date(),
      };
    }

    const adx = adxResult.adx;

    if (volatility > this.VOLATILITY_SHOCK_THRESHOLD) {
      return {
        regime: MarketRegime.SHOCK,
        confidence: Math.min(volatility / this.VOLATILITY_SHOCK_THRESHOLD, 1.0),
        adx,
        volatility,
        timestamp: new Date(),
      };
    }

    if (adx >= this.ADX_STRONG_TREND_THRESHOLD) {
      return {
        regime: MarketRegime.TREND,
        confidence: Math.min(adx / this.ADX_STRONG_TREND_THRESHOLD, 1.0),
        adx,
        volatility,
        timestamp: new Date(),
      };
    }

    if (adx >= this.ADX_TREND_THRESHOLD) {
      return {
        regime: MarketRegime.TREND,
        confidence: adx / this.ADX_STRONG_TREND_THRESHOLD,
        adx,
        volatility,
        timestamp: new Date(),
      };
    }

    return {
      regime: MarketRegime.RANGE,
      confidence: Math.max(0, (this.ADX_TREND_THRESHOLD - adx) / this.ADX_TREND_THRESHOLD),
      adx,
      volatility,
      timestamp: new Date(),
    };
  }

  private calculateVolatility(bars: OhlcvBarDTO[], period: number): number {
    if (bars.length < period) {
      return 0;
    }

    const returns: number[] = [];

    for (let i = bars.length - period; i < bars.length - 1; i++) {
      const returnPct = (bars[i + 1].close - bars[i].close) / bars[i].close;
      returns.push(returnPct);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev;
  }

  classifyRegimeForStrategy(regime: MarketRegime, strategyCategory: string): boolean {
    const suitability: Record<string, MarketRegime[]> = {
      scalping: [MarketRegime.RANGE, MarketRegime.TREND],
      trend_follow: [MarketRegime.TREND],
      mean_revert: [MarketRegime.RANGE],
    };

    const suitable = suitability[strategyCategory] || [];
    return suitable.includes(regime);
  }
}
