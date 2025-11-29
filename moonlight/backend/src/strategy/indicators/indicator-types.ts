export interface IndicatorInputSeries {
  close: number[];
  high?: number[];
  low?: number[];
  volume?: number[];
}

export interface BollingerBandsResult {
  middle: number;
  upper: number;
  lower: number;
  width: number;
}

export interface RsiResult {
  value: number;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface AdxResult {
  adx: number;
}

export interface EmaResult {
  value: number;
}
