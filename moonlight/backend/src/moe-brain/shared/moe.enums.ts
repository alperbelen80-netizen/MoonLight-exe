// MoonLight V2.0 — MoE Brain Enums
// Canonical enums for the 3 Local MoE brains + Global Orchestrator.

export enum BrainType {
  CEO = 'CEO',
  TRADE = 'TRADE',
  TEST = 'TEST',
}

export enum ExpertRole {
  // CEO-MoE roster
  TREND = 'TREND',
  MEAN_REVERSION = 'MEAN_REVERSION',
  VOLATILITY = 'VOLATILITY',
  NEWS = 'NEWS',
  MACRO = 'MACRO',

  // TRADE-MoE roster
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
  SLIPPAGE = 'SLIPPAGE',
  PAYOUT = 'PAYOUT',
  SESSION = 'SESSION',

  // TEST-MoE roster (deterministic red team)
  OVERFIT_HUNTER = 'OVERFIT_HUNTER',
  DATA_LEAK_DETECTOR = 'DATA_LEAK_DETECTOR',
  BIAS_AUDITOR = 'BIAS_AUDITOR',
  ADVERSARIAL_ATTACKER = 'ADVERSARIAL_ATTACKER',
  ROBUSTNESS_TESTER = 'ROBUSTNESS_TESTER',
}

export enum SynapticRule {
  RESIDUAL = 'RESIDUAL',
  HEBBIAN = 'HEBBIAN',
  ANTI_HEBBIAN = 'ANTI_HEBBIAN',
  HOMEOSTATIC = 'HOMEOSTATIC',
  PLASTIC = 'PLASTIC',
  SPIKE = 'SPIKE',
}

export enum MoEDecision {
  ALLOW = 'ALLOW',
  SKIP = 'SKIP',
  VETO = 'VETO',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum ExpertVote {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  NEUTRAL = 'NEUTRAL',
}
