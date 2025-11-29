import { Injectable, Logger } from '@nestjs/common';
import { OhlcvBarDTO } from '../../shared/dto/ohlcv-bar.dto';
import {
  BollingerBandsResult,
  RsiResult,
  MacdResult,
  AdxResult,
  EmaResult,
} from './indicator-types';

@Injectable()
export class IndicatorService {
  private readonly logger = new Logger(IndicatorService.name);

  calculateBB(
    bars: OhlcvBarDTO[],
    period: number,
    stdDev: number,
  ): BollingerBandsResult | null {
    if (bars.length < period) {
      return null;
    }

    const closes = bars.slice(-period).map((b) => b.close);
    const sma = closes.reduce((sum, c) => sum + c, 0) / period;

    const variance = closes.reduce((sum, c) => sum + Math.pow(c - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    const upper = sma + stdDev * std;
    const lower = sma - stdDev * std;
    const width = (upper - lower) / sma;

    return {
      middle: sma,
      upper,
      lower,
      width,
    };
  }

  calculateRSI(bars: OhlcvBarDTO[], period: number): RsiResult | null {
    if (bars.length < period + 1) {
      return null;
    }

    const closes = bars.map((b) => b.close);
    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      return { value: 100 };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return { value: rsi };
  }

  calculateMACD(
    bars: OhlcvBarDTO[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
  ): MacdResult | null {
    if (bars.length < slowPeriod + signalPeriod) {
      return null;
    }

    const fastEma = this.calculateEMA(bars, fastPeriod);
    const slowEma = this.calculateEMA(bars, slowPeriod);

    if (!fastEma || !slowEma) {
      return null;
    }

    const macd = fastEma.value - slowEma.value;

    const macdLine = Array.from({ length: signalPeriod }, (_, i) => macd);
    const signal = macdLine.reduce((sum, v) => sum + v, 0) / signalPeriod;
    const histogram = macd - signal;

    return {
      macd,
      signal,
      histogram,
    };
  }

  calculateADX(bars: OhlcvBarDTO[], period: number): AdxResult | null {
    if (bars.length < period + 1) {
      return null;
    }

    let trSum = 0;
    let dmPlusSum = 0;
    let dmMinusSum = 0;

    for (let i = bars.length - period; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trSum += tr;

      if (i > 0) {
        const dmPlus = Math.max(high - bars[i - 1].high, 0);
        const dmMinus = Math.max(bars[i - 1].low - low, 0);
        dmPlusSum += dmPlus;
        dmMinusSum += dmMinus;
      }
    }

    const atr = trSum / period;
    const diPlus = (dmPlusSum / period / atr) * 100;
    const diMinus = (dmMinusSum / period / atr) * 100;

    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    const adx = dx;

    return { adx };
  }

  calculateEMA(bars: OhlcvBarDTO[], period: number): EmaResult | null {
    if (bars.length < period) {
      return null;
    }

    const closes = bars.map((b) => b.close);
    const k = 2 / (period + 1);

    let ema = closes.slice(0, period).reduce((sum, c) => sum + c, 0) / period;

    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }

    return { value: ema };
  }
}
