export enum SlotDecision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export interface SlotSelectionResult {
  decision: SlotDecision;
  selected_expiry_minutes: number | null;
  expected_ev: number;
  effective_payout_ratio: number;
  reason_codes: string[];
}

export interface SlotEvaluationContext {
  signal_ev: number;
  signal_confidence: number;
  slot_minutes: number;
  payout_ratio: number;
  reliability_factor: number;
}
