// MoonLight V2.0 — Trinity Oversight DTO contracts.

import { OversightVerdict, TrainingMode } from './trinity.enums';

export interface ResourceSnapshot {
  cpuUsagePct: number; // 0..100
  memUsagePct: number; // 0..100
  eventLoopLagMs: number;
  queueDepth: number;
  latencyP95Ms: number;
  timestampUtc: string;
}

export interface Eye1Report {
  eye: 'EYE_1_SYSTEM_OBSERVER';
  verdict: OversightVerdict;
  budgetPct: number; // max allowed utilization (static, e.g. 80)
  snapshot: ResourceSnapshot;
  notes: string[];
}

export interface Eye2Report {
  eye: 'EYE_2_DECISION_AUDITOR';
  verdict: OversightVerdict;
  auditedCount: number;
  driftScore: number; // 0..1, crude PSI-like placeholder
  recentReasonCodes: string[];
}

export interface Eye3Report {
  eye: 'EYE_3_TOPOLOGY_GOVERNOR';
  verdict: OversightVerdict;
  trainingMode: TrainingMode;
  synapticHealth: number; // 0..1
  notes: string[];
}

export interface TrinityStatus {
  eye1: Eye1Report;
  eye2: Eye2Report;
  eye3: Eye3Report;
  consensus: OversightVerdict; // 2-of-3 majority
  timestampUtc: string;
}
