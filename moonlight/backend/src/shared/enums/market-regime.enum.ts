export enum MarketRegime {
  TREND = 'TREND',
  RANGE = 'RANGE',
  SHOCK = 'SHOCK',
  UNKNOWN = 'UNKNOWN',
}

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number;
  adx: number;
  volatility: number;
  timestamp: Date;
}
