export enum Timeframe {
  ONE_SECOND = '1s',
  THREE_SECOND = '3s',
  FIVE_SECOND = '5s',
  FIFTEEN_SECOND = '15s',
  THIRTY_SECOND = '30s',
  ONE_MINUTE = '1m',
  FIVE_MINUTE = '5m',
  FIFTEEN_MINUTE = '15m',
  THIRTY_MINUTE = '30m',
  ONE_HOUR = '1h',
  FOUR_HOUR = '4h',
  ONE_DAY = '1d',
}

export const TIMEFRAME_TO_MS: Record<Timeframe, number> = {
  [Timeframe.ONE_SECOND]: 1000,
  [Timeframe.THREE_SECOND]: 3000,
  [Timeframe.FIVE_SECOND]: 5000,
  [Timeframe.FIFTEEN_SECOND]: 15000,
  [Timeframe.THIRTY_SECOND]: 30000,
  [Timeframe.ONE_MINUTE]: 60000,
  [Timeframe.FIVE_MINUTE]: 300000,
  [Timeframe.FIFTEEN_MINUTE]: 900000,
  [Timeframe.THIRTY_MINUTE]: 1800000,
  [Timeframe.ONE_HOUR]: 3600000,
  [Timeframe.FOUR_HOUR]: 14400000,
  [Timeframe.ONE_DAY]: 86400000,
};

export const TIMEFRAME_TO_EXPECTED_BARS_PER_DAY: Record<Timeframe, number> = {
  [Timeframe.ONE_SECOND]: 86400,
  [Timeframe.THREE_SECOND]: 28800,
  [Timeframe.FIVE_SECOND]: 17280,
  [Timeframe.FIFTEEN_SECOND]: 5760,
  [Timeframe.THIRTY_SECOND]: 2880,
  [Timeframe.ONE_MINUTE]: 1440,
  [Timeframe.FIVE_MINUTE]: 288,
  [Timeframe.FIFTEEN_MINUTE]: 96,
  [Timeframe.THIRTY_MINUTE]: 48,
  [Timeframe.ONE_HOUR]: 24,
  [Timeframe.FOUR_HOUR]: 6,
  [Timeframe.ONE_DAY]: 1,
};
