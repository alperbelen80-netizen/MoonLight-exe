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
    const changes: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    if (changes.length < period) {
      return null;
    }

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    for (let i = period; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

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

    const closes = bars.map((b) => b.close);
    const fastEmaValues = this.calculateEMASequence(closes, fastPeriod);
    const slowEmaValues = this.calculateEMASequence(closes, slowPeriod);

    if (fastEmaValues.length === 0 || slowEmaValues.length === 0) {
      return null;
    }

    const macdLine: number[] = [];
    const minLength = Math.min(fastEmaValues.length, slowEmaValues.length);

    for (let i = 0; i < minLength; i++) {
      macdLine.push(fastEmaValues[i] - slowEmaValues[i]);
    }

    if (macdLine.length < signalPeriod) {
      return null;
    }

    const signalEma = this.calculateEMASequence(macdLine, signalPeriod);

    if (signalEma.length === 0) {
      return null;
    }

    const macd = macdLine[macdLine.length - 1];
    const signal = signalEma[signalEma.length - 1];
    const histogram = macd - signal;

    return {
      macd,
      signal,
      histogram,
    };
  }

  private calculateEMASequence(values: number[], period: number): number[] {
    if (values.length < period) {
      return [];
    }

    const k = 2 / (period + 1);
    const emaValues: number[] = [];

    let ema = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    emaValues.push(ema);

    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
      emaValues.push(ema);
    }

    return emaValues;
  }

  calculateADX(bars: OhlcvBarDTO[], period: number): AdxResult | null {
    if (bars.length < period * 2) {
      return null;
    }

    const trValues: number[] = [];
    const dmPlusValues: number[] = [];
    const dmMinusValues: number[] = [];

    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevHigh = bars[i - 1].high;
      const prevLow = bars[i - 1].low;
      const prevClose = bars[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trValues.push(tr);

      const highDiff = high - prevHigh;
      const lowDiff = prevLow - low;

      let dmPlus = 0;
      let dmMinus = 0;

      if (highDiff > lowDiff && highDiff > 0) {
        dmPlus = highDiff;
      }
      if (lowDiff > highDiff && lowDiff > 0) {
        dmMinus = lowDiff;
      }

      dmPlusValues.push(dmPlus);
      dmMinusValues.push(dmMinus);
    }

    if (trValues.length < period) {
      return null;
    }

    let atr = trValues.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    let smoothDmPlus = dmPlusValues.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    let smoothDmMinus = dmMinusValues.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    const dxValues: number[] = [];

    for (let i = period; i < trValues.length; i++) {
      atr = (atr * (period - 1) + trValues[i]) / period;
      smoothDmPlus = (smoothDmPlus * (period - 1) + dmPlusValues[i]) / period;
      smoothDmMinus = (smoothDmMinus * (period - 1) + dmMinusValues[i]) / period;

      const diPlus = atr !== 0 ? (smoothDmPlus / atr) * 100 : 0;
      const diMinus = atr !== 0 ? (smoothDmMinus / atr) * 100 : 0;

      const diSum = diPlus + diMinus;
      const dx = diSum !== 0 ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0;

      dxValues.push(dx);
    }

    if (dxValues.length < period) {
      return null;
    }

    let adx = dxValues.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    for (let i = period; i < dxValues.length; i++) {
      adx = (adx * (period - 1) + dxValues[i]) / period;
    }

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
