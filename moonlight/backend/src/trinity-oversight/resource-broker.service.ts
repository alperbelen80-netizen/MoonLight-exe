// MoonLight V2.0 — Ray-local-mode resource broker stub.
//
// Purpose: centralize "can we run this job right now?" decisions.
// Policy: MAX_BUDGET_PCT (default 80) — if current cpu/mem above this,
// we tell callers to back off. No real Ray import here — we model the
// same contract so swapping to Ray cluster later is a drop-in.
//
// Fail-closed: if we cannot measure, we assume budget exceeded.

import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

export interface BudgetVerdict {
  allowed: boolean;
  cpuUsagePct: number;
  memUsagePct: number;
  budgetPct: number;
  reason?: string;
}

@Injectable()
export class ResourceBrokerService {
  private readonly logger = new Logger(ResourceBrokerService.name);
  private readonly budgetPct: number;
  private lastCpuSample: {
    idle: number;
    total: number;
  } | null = null;

  constructor() {
    const raw = parseInt(process.env.MOE_BUDGET_PCT || '80', 10);
    // clamp to sane bounds
    this.budgetPct = Math.min(95, Math.max(10, isNaN(raw) ? 80 : raw));
  }

  getBudgetPct(): number {
    return this.budgetPct;
  }

  /**
   * Sample OS metrics. Intentionally cheap — avoids external deps.
   * CPU% uses delta across consecutive calls; first call returns 0 (warm up).
   */
  sample(): { cpuUsagePct: number; memUsagePct: number } {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      for (const t of Object.values(cpu.times) as number[]) {
        total += t;
      }
      idle += cpu.times.idle;
    }
    let cpuUsagePct = 0;
    if (this.lastCpuSample) {
      const idleDiff = idle - this.lastCpuSample.idle;
      const totalDiff = total - this.lastCpuSample.total;
      if (totalDiff > 0) {
        cpuUsagePct = 100 * (1 - idleDiff / totalDiff);
      }
    }
    this.lastCpuSample = { idle, total };

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsagePct = totalMem > 0 ? 100 * (1 - freeMem / totalMem) : 100;

    return {
      cpuUsagePct: this.clamp(cpuUsagePct, 0, 100),
      memUsagePct: this.clamp(memUsagePct, 0, 100),
    };
  }

  requestBudget(weight = 1): BudgetVerdict {
    try {
      const { cpuUsagePct, memUsagePct } = this.sample();
      const worst = Math.max(cpuUsagePct, memUsagePct);
      const effectiveBudget = this.budgetPct / Math.max(1, weight);
      const allowed = worst < effectiveBudget;
      return {
        allowed,
        cpuUsagePct,
        memUsagePct,
        budgetPct: this.budgetPct,
        reason: allowed
          ? undefined
          : `worst_util=${worst.toFixed(1)}% >= budget=${effectiveBudget.toFixed(1)}%`,
      };
    } catch (err) {
      // Fail-closed
      this.logger.warn(`ResourceBroker sample failed: ${(err as Error).message}`);
      return {
        allowed: false,
        cpuUsagePct: 100,
        memUsagePct: 100,
        budgetPct: this.budgetPct,
        reason: 'sample_failed_fail_closed',
      };
    }
  }

  private clamp(v: number, lo: number, hi: number): number {
    if (!Number.isFinite(v)) return lo;
    return Math.min(hi, Math.max(lo, v));
  }
}
