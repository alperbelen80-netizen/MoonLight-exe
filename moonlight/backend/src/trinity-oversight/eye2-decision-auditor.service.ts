// GÖZ-2 — Decision Auditor. V2.0-α: in-memory ring buffer of reason codes.
// In later phases it will persist per-signal decision traces.

import { Injectable } from '@nestjs/common';
import { Eye2Report } from './shared/trinity.contracts';
import { OversightVerdict } from './shared/trinity.enums';

interface AuditRecord {
  signalId: string;
  reasonCodes: string[];
  at: string;
}

@Injectable()
export class Eye2DecisionAuditorService {
  private readonly maxRecords = 500;
  private readonly records: AuditRecord[] = [];

  record(signalId: string, reasonCodes: string[]): void {
    this.records.push({
      signalId,
      reasonCodes: [...reasonCodes],
      at: new Date().toISOString(),
    });
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  report(): Eye2Report {
    const lastN = this.records.slice(-50);
    const allCodes = lastN.flatMap((r) => r.reasonCodes);

    // Crude drift placeholder: diversity of reason codes (lower diversity = drifting).
    const unique = new Set(allCodes).size;
    const driftScore =
      lastN.length === 0 ? 0 : Math.max(0, 1 - unique / Math.max(1, lastN.length));

    let verdict = OversightVerdict.OK;
    if (driftScore >= 0.85) verdict = OversightVerdict.WARN;

    return {
      eye: 'EYE_2_DECISION_AUDITOR',
      verdict,
      auditedCount: this.records.length,
      driftScore: Number(driftScore.toFixed(3)),
      recentReasonCodes: Array.from(new Set(allCodes)).slice(0, 10),
    };
  }

  // Test helper
  clear(): void {
    this.records.length = 0;
  }
}
