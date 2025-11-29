export interface SlotConfig {
  allowed_slots_minutes: number[];
  min_ev: number;
  min_confidence: number;
  min_payout_ratio: number;
  max_concurrent_per_slot: number;
  reliability_factor: number;
}

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  allowed_slots_minutes: [1, 5, 15, 30, 60],
  min_ev: 0.02,
  min_confidence: 0.60,
  min_payout_ratio: 0.80,
  max_concurrent_per_slot: 3,
  reliability_factor: 0.90,
};

export const MOCK_PAYOUT_MATRIX: Record<number, number> = {
  1: 0.82,
  5: 0.85,
  15: 0.87,
  30: 0.88,
  60: 0.89,
  240: 0.90,
};
