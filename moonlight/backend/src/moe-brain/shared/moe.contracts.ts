// MoonLight V2.0 — Core DTO/Contract shapes for MoE pipeline.
// These contracts are intentionally framework-agnostic.

import { BrainType, ExpertRole, ExpertVote, MoEDecision } from './moe.enums';

export interface SignalInput {
  signalId: string;
  symbol: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidenceScore?: number;
  timestampUtc: string;
  meta?: Record<string, unknown>;
}

export interface ExpertOutput {
  role: ExpertRole;
  vote: ExpertVote;
  confidence: number; // 0..1
  rationale?: string;
  reasonCodes?: string[];
  latencyMs?: number;
  error?: string;
}

export interface BrainOutput {
  brain: BrainType;
  experts: ExpertOutput[];
  // Softmax-weighted aggregate vote for this brain.
  aggregate: {
    vote: ExpertVote;
    confidence: number; // 0..1
    weights: Partial<Record<ExpertRole, number>>;
  };
  vetoFlag?: boolean;
  latencyMs: number;
  timestampUtc: string;
}

export interface EnsembleDecision {
  decision: MoEDecision;
  confidence: number;
  reasonCodes: string[];
  brains: BrainOutput[];
  finalWeights: {
    ceo: number;
    trade: number;
    test: number;
  };
  timestampUtc: string;
}
