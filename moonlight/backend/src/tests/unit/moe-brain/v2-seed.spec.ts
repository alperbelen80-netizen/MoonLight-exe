import { buildV2SeedRows, V2_SYMBOLS, V2_TIMEFRAMES } from '../../../moe-brain/v2-seed';

describe('V2 Product Seed', () => {
  it('exports 38 symbols and 7 timeframes', () => {
    expect(V2_SYMBOLS.length).toBe(38);
    expect(V2_TIMEFRAMES.length).toBe(7);
  });

  it('produces 38 * 7 = 266 rows with unique ids', () => {
    const rows = buildV2SeedRows();
    expect(rows.length).toBe(38 * 7);
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(rows.length);
  });

  it('formats ids as SYMBOL__TF', () => {
    const rows = buildV2SeedRows();
    const sample = rows.find((r) => r.symbol === 'EURUSD' && r.tf === '5m');
    expect(sample).toBeDefined();
    expect(sample?.id).toBe('EURUSD__5m');
  });

  it('includes all three asset classes', () => {
    const rows = buildV2SeedRows();
    const syms = new Set(rows.map((r) => r.symbol));
    // Forex
    expect(syms.has('EURUSD')).toBe(true);
    // Commodity
    expect(syms.has('XAUUSD')).toBe(true);
    // Crypto
    expect(syms.has('BTCUSDT')).toBe(true);
  });

  it('covers the required timeframe set', () => {
    expect(V2_TIMEFRAMES).toEqual(['5m', '15m', '30m', '1h', '2h', '4h', '8h']);
  });
});
