export interface PackDefinition {
  id: string;
  name: string;
  strategy_ids: string[];
  weights: Record<string, number>;
  min_agreement: number;
}

export interface PackDecisionResult {
  pack_id: string;
  selected_signal: any | null;
  reason_codes: string[];
  scores: Record<string, number>;
}
