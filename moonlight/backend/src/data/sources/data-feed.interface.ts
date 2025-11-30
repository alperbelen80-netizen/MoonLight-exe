export interface CandleData {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleHandler = (candle: CandleData) => void;

export interface IDataFeedAdapter {
  subscribeToCandles(
    symbol: string,
    timeframe: string,
    handler: CandleHandler,
  ): Promise<void>;

  unsubscribeFromCandles(symbol: string, timeframe: string): Promise<void>;

  listSupportedSymbols(): Promise<string[]>;

  isConnected(): boolean;

  disconnect(): Promise<void>;
}
