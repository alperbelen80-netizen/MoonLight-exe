// MoonLight V2.0 — V2 product seed set.
// 38 pairs × 7 timeframes  = 266 product_execution_config rows.
// Timeframes: 5m, 15m, 30m, 1h, 2h, 4h, 8h

export const V2_TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '8h'] as const;
export type V2Timeframe = (typeof V2_TIMEFRAMES)[number];

export const V2_SYMBOLS: readonly string[] = [
  // Forex majors
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'NZDUSD',
  'USDCAD',
  'USDCHF',
  // Forex crosses
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'AUDJPY',
  // Commodities
  'XAUUSD',
  'XAGUSD',
  'WTIUSD',
  'BRENTUSD',
  // Crypto top
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'BNBUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'MATICUSDT',
  'DOTUSDT',
  'LTCUSDT',
  'TRXUSDT',
  'SHIBUSDT',
  'ATOMUSDT',
  'NEARUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'SUIUSDT',
  'ETCUSDT',
  'FILUSDT',
  'ICPUSDT',
] as const;

export interface V2SeedRow {
  id: string;
  symbol: string;
  tf: string;
}

export function buildV2SeedRows(): V2SeedRow[] {
  const rows: V2SeedRow[] = [];
  for (const s of V2_SYMBOLS) {
    for (const tf of V2_TIMEFRAMES) {
      rows.push({ id: `${s}__${tf}`, symbol: s, tf });
    }
  }
  return rows;
}
