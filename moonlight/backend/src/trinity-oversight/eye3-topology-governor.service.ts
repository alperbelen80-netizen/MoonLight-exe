// GÖZ-3 — Topology & Learning Governor.
// V2.0-α: holds training mode + synaptic weight snapshot (stubbed).

import { Injectable } from '@nestjs/common';
import { Eye3Report } from './shared/trinity.contracts';
import { OversightVerdict, TrainingMode } from './shared/trinity.enums';
import { ResourceBrokerService } from './resource-broker.service';

@Injectable()
export class Eye3TopologyGovernorService {
  private trainingMode: TrainingMode = TrainingMode.OFF;
  private synapticHealth = 1.0;

  constructor(private readonly broker: ResourceBrokerService) {}

  getTrainingMode(): TrainingMode {
    return this.trainingMode;
  }

  setTrainingMode(enabled: boolean): TrainingMode {
    if (!enabled) {
      this.trainingMode = TrainingMode.OFF;
      return this.trainingMode;
    }
    const budget = this.broker.requestBudget(2); // training is expensive → weight 2x
    if (!budget.allowed) {
      this.trainingMode = TrainingMode.PAUSED_BY_BUDGET;
      return this.trainingMode;
    }
    this.trainingMode = TrainingMode.ON;
    return this.trainingMode;
  }

  setSynapticHealth(value: number): void {
    if (!Number.isFinite(value)) return;
    this.synapticHealth = Math.min(1, Math.max(0, value));
  }

  report(): Eye3Report {
    const notes: string[] = [];
    let verdict = OversightVerdict.OK;

    if (this.trainingMode === TrainingMode.PAUSED_BY_BUDGET) {
      verdict = OversightVerdict.WARN;
      notes.push('training_paused_by_budget');
    }
    if (this.synapticHealth < 0.5) {
      verdict = OversightVerdict.WARN;
      notes.push(`synaptic_health_low=${this.synapticHealth.toFixed(2)}`);
    }

    return {
      eye: 'EYE_3_TOPOLOGY_GOVERNOR',
      verdict,
      trainingMode: this.trainingMode,
      synapticHealth: Number(this.synapticHealth.toFixed(3)),
      notes,
    };
  }
}
