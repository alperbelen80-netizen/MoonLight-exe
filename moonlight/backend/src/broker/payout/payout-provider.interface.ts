export interface PayoutData {
  symbol: string;
  expiry_minutes: number;
  payout_ratio: number;
  timestamp: Date;
  source: 'BROKER_API' | 'UI_SCRAPE' | 'STATIC' | 'CACHED';
}

export interface PayoutMatrix {
  [symbol: string]: {
    [expiry: number]: PayoutData;
  };
}

export interface IPayoutProvider {
  getPayoutForSlot(
    symbol: string,
    expiryMinutes: number,
  ): Promise<PayoutData | null>;

  refreshPayoutMatrix(): Promise<void>;

  getLastUpdateTime(): Date | null;
}
