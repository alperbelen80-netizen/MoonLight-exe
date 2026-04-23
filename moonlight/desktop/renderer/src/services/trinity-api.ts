// MoonLight V2.0 — Trinity Oversight + MoE API client.
// Uses existing api-client.ts helpers for consistency.

import { apiGet, apiPost } from './api-client';

export type OversightVerdict = 'OK' | 'WARN' | 'HALT';
export type TrainingMode = 'OFF' | 'ON' | 'PAUSED_BY_BUDGET';

export interface ResourceSnapshot {
  cpuUsagePct: number;
  memUsagePct: number;
  eventLoopLagMs: number;
  queueDepth: number;
  latencyP95Ms: number;
  timestampUtc: string;
}

export interface Eye1Report {
  eye: 'EYE_1_SYSTEM_OBSERVER';
  verdict: OversightVerdict;
  budgetPct: number;
  snapshot: ResourceSnapshot;
  notes: string[];
}

export interface Eye2Report {
  eye: 'EYE_2_DECISION_AUDITOR';
  verdict: OversightVerdict;
  auditedCount: number;
  driftScore: number;
  recentReasonCodes: string[];
}

export interface Eye3Report {
  eye: 'EYE_3_TOPOLOGY_GOVERNOR';
  verdict: OversightVerdict;
  trainingMode: TrainingMode;
  synapticHealth: number;
  notes: string[];
}

export interface TrinityStatus {
  eye1: Eye1Report;
  eye2: Eye2Report;
  eye3: Eye3Report;
  consensus: OversightVerdict;
  timestampUtc: string;
}

export interface EnsembleWeights {
  ceo: number;
  trade: number;
  test: number;
}

export interface BrainRoster {
  CEO: string[];
  TRADE: string[];
  TEST: string[];
}

export const TrinityApi = {
  status: () => apiGet<TrinityStatus>('/api/trinity/status'),
  audit: () => apiGet<Eye2Report>('/api/trinity/audit'),
  topology: () => apiGet<Eye3Report>('/api/trinity/topology'),
  setTraining: (enabled: boolean) =>
    apiPost<{ trainingMode: TrainingMode }>('/api/trinity/training', { enabled }),
};

export const MoEApi = {
  weights: () => apiGet<EnsembleWeights>('/api/moe/weights'),
  roster: () => apiGet<BrainRoster>('/api/moe/brain/roster'),
  seedPreview: () =>
    apiGet<{ symbols: string[]; timeframes: string[]; expectedRows: number }>(
      '/api/moe/seed/preview',
    ),
  seedApply: () =>
    apiPost<{ expected: number; existing: number; inserted: number; idempotent: boolean }>(
      '/api/moe/seed/apply',
    ),
};

export interface SynapticConfigDto {
  learningRate: number;
  decay: number;
  maxStep: number;
  targetRate: number;
  spikeThreshold: number;
  minWeight: number;
  maxWeight: number;
}

export const SynapticApi = {
  getConfig: () => apiGet<SynapticConfigDto>('/api/moe/synaptic/config'),
  setConfig: (patch: Partial<SynapticConfigDto>) =>
    apiPost<SynapticConfigDto>('/api/moe/synaptic/config', patch),
  rules: () => apiGet<string[]>('/api/moe/synaptic/rules'),
};

export interface LearningSnapshot {
  brain: 'CEO' | 'TRADE' | 'TEST';
  updatedAt: string;
  priors: Record<string, number>;
  health: number;
}

export const LearningApi = {
  snapshot: () => apiGet<LearningSnapshot[]>('/api/moe/learning/snapshot'),
  step: () => apiPost<{ ran: boolean; reason: string; snapshots?: LearningSnapshot[] }>('/api/moe/learning/step'),
  schedulerStatus: () =>
    apiGet<{ enabled: boolean; history: { at: string; ran: boolean; reason: string; brains?: number }[] }>(
      '/api/moe/learning/scheduler',
    ),
  schedulerTick: () =>
    apiPost<{ at: string; ran: boolean; reason: string; brains?: number }>(
      '/api/moe/learning/scheduler/tick',
    ),
};

export interface TemplateStats {
  total: number;
  implemented: number;
  dormant: number;
  registeredTotal: number;
}

export const StrategyTemplatesApi = {
  stats: () => apiGet<TemplateStats>('/api/strategy/templates/stats'),
  registerAll: () =>
    apiPost<{ implemented: number; dormant: number; total: number }>(
      '/api/strategy/templates/register-all',
    ),
};

export interface IndicatorStats {
  totalIndicators: number;
  totalTemplates: number;
  implementedIndicators: number;
  implementedTemplates: number;
  familyCounts: Record<string, number>;
}

export const IndicatorsApi = {
  stats: () => apiGet<IndicatorStats>('/api/indicators/stats'),
};
