export interface DailyPnlPoint {
  date: string;
  environment: 'LIVE' | 'SANDBOX';
  trades: number;
  wins: number;
  losses: number;
  blocked_by_risk: number;
  blocked_by_ev: number;
  blocked_by_hw_profile: number;
  net_pnl: number;
}

export interface PnlHistoryDTO {
  points: DailyPnlPoint[];
  range: string;
  generated_at_utc: string;
}
