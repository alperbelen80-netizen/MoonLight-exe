export enum GatingDecision {
  SELECT_ONE = 'SELECT_ONE',
  REJECT_ALL = 'REJECT_ALL',
}

export interface GatingContext {
  signals: any[];
  scores: Record<string, number>;
  threshold_delta: number;
}

export interface GatingResult {
  decision: GatingDecision;
  selected_signal: any | null;
  reason_codes: string[];
}
