// MoonLight V2.5-5 — Ray-local-mode resource broker (GPU simulation).
//
// Extends the V2.0 ResourceBroker stub (cpu/mem sampling + %80 budget clamp)
// with:
//   * CPU + GPU "token bucket" accounting so long-running learners and
//     backtests can reserve / release capacity deterministically.
//   * A lightweight FIFO job queue that enforces the %80 headroom even
//     before sampling — i.e. we never hand out more tokens than budget.
//   * Ray-simulation toggle so operators can preview the scheduler in a
//     controlled, reproducible way without requiring an actual Ray cluster.
//
// Contract is intentionally compatible with Ray's "resource request"
// semantics: callers `acquire({cpu, gpu})`, do work, then `release()`.
// Dropping in a real Ray client later is a one-adapter swap.

import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

export interface BudgetVerdict {
  allowed: boolean;
  cpuUsagePct: number;
  memUsagePct: number;
  budgetPct: number;
  reason?: string;
}

export interface ResourceRequest {
  cpu?: number; // in "tokens" (1 token ≈ 1 vCPU)
  gpu?: number; // simulated GPU tokens
  priority?: number; // 0 = normal, 1 = high, 2 = critical
  ownerId?: string; // job / brain identifier for audit
}

export interface ResourceLease {
  leaseId: string;
  acquiredAtMs: number;
  cpu: number;
  gpu: number;
  ownerId?: string;
  priority: number;
}

export interface ResourceBrokerSnapshot {
  budgetPct: number;
  cpuUsagePct: number;
  memUsagePct: number;
  cpu: { total: number; used: number; free: number };
  gpu: { total: number; used: number; free: number };
  leases: ResourceLease[];
  queueDepth: number;
  simulationEnabled: boolean;
  sessionTotals: {
    acquired: number;
    rejected: number;
    released: number;
  };
}

interface PendingRequest {
  req: ResourceRequest;
  resolve: (lease: ResourceLease | null) => void;
  enqueuedAtMs: number;
  // How long we'll keep this queued before giving up (deterministic failure).
  deadlineMs: number;
}

/**
 * ResourceBrokerService
 *
 * Central gatekeeper for *any* heavy-work request:
 *   - MoE training cycles
 *   - backtests / replay runs
 *   - genetic algorithm sweeps
 *   - large indicator recomputations
 *
 * Exposes a promise-based acquire()/release() pair. Respects:
 *   - MOE_BUDGET_PCT   (max % of total resources we'll commit)
 *   - RESOURCE_CPU_TOKENS  (default = os.cpus().length)
 *   - RESOURCE_GPU_TOKENS  (default = 0 if not set; simulation can raise it)
 *   - RESOURCE_SIMULATION_ENABLED (on → simulated GPU pool is made available)
 */
@Injectable()
export class ResourceBrokerService {
  private readonly logger = new Logger(ResourceBrokerService.name);
  private readonly budgetPct: number;

  private readonly cpuTotal: number;
  private gpuTotal: number;

  private cpuUsed = 0;
  private gpuUsed = 0;

  private simulationEnabled: boolean;

  private leases: Map<string, ResourceLease> = new Map();
  private queue: PendingRequest[] = [];
  private leaseSeq = 0;

  private sessionTotals = { acquired: 0, rejected: 0, released: 0 };

  private lastCpuSample: { idle: number; total: number } | null = null;

  constructor() {
    const raw = parseInt(process.env.MOE_BUDGET_PCT || '80', 10);
    this.budgetPct = Math.min(95, Math.max(10, isNaN(raw) ? 80 : raw));

    const cpuTokensRaw = parseInt(process.env.RESOURCE_CPU_TOKENS || '', 10);
    this.cpuTotal =
      Number.isFinite(cpuTokensRaw) && cpuTokensRaw > 0
        ? cpuTokensRaw
        : Math.max(1, os.cpus().length);

    const gpuTokensRaw = parseInt(process.env.RESOURCE_GPU_TOKENS || '', 10);
    this.gpuTotal =
      Number.isFinite(gpuTokensRaw) && gpuTokensRaw >= 0 ? gpuTokensRaw : 0;

    this.simulationEnabled =
      process.env.RESOURCE_SIMULATION_ENABLED === 'true';
    if (this.simulationEnabled && this.gpuTotal === 0) {
      // Default simulated GPU fleet: 4 virtual GPUs. Operators can override
      // with RESOURCE_GPU_TOKENS=N if they want a specific sim topology.
      this.gpuTotal = 4;
    }
  }

  // ---- Budget / sampling API (backwards-compatible with V2.0) ----

  getBudgetPct(): number {
    return this.budgetPct;
  }

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
      this.logger.warn(
        `ResourceBroker sample failed: ${(err as Error).message}`,
      );
      return {
        allowed: false,
        cpuUsagePct: 100,
        memUsagePct: 100,
        budgetPct: this.budgetPct,
        reason: 'sample_failed_fail_closed',
      };
    }
  }

  // ---- Token-bucket / lease API (V2.5-5) ----

  private cpuCap(): number {
    return Math.floor((this.cpuTotal * this.budgetPct) / 100);
  }

  private gpuCap(): number {
    // GPU cap ≈ full GPU pool × budget. We keep the same headroom logic
    // so operators can never commit 100% of simulated GPUs.
    return Math.floor((this.gpuTotal * this.budgetPct) / 100);
  }

  /**
   * Try to immediately acquire the requested resources. Returns null when
   * the request would exceed the %budget cap (callers can enqueue instead).
   */
  tryAcquire(req: ResourceRequest): ResourceLease | null {
    const cpu = Math.max(0, Math.floor(req.cpu ?? 1));
    const gpu = Math.max(0, Math.floor(req.gpu ?? 0));

    if (cpu > this.cpuCap() || gpu > this.gpuCap()) {
      // Impossible to ever serve — reject up front.
      this.sessionTotals.rejected++;
      return null;
    }
    if (this.cpuUsed + cpu > this.cpuCap()) return null;
    if (this.gpuUsed + gpu > this.gpuCap()) return null;

    this.cpuUsed += cpu;
    this.gpuUsed += gpu;
    this.leaseSeq++;
    const lease: ResourceLease = {
      leaseId: `lease_${Date.now()}_${this.leaseSeq}`,
      acquiredAtMs: Date.now(),
      cpu,
      gpu,
      ownerId: req.ownerId,
      priority: req.priority ?? 0,
    };
    this.leases.set(lease.leaseId, lease);
    this.sessionTotals.acquired++;
    return lease;
  }

  /**
   * Asynchronous acquire with optional deadline. If the resources are not
   * immediately available, the request is queued and will be served in
   * FIFO order (priority bumps to the front). Resolves with `null` if
   * the deadline elapses.
   */
  acquire(req: ResourceRequest, timeoutMs = 30_000): Promise<ResourceLease | null> {
    const immediate = this.tryAcquire(req);
    if (immediate) return Promise.resolve(immediate);

    return new Promise<ResourceLease | null>((resolve) => {
      const pending: PendingRequest = {
        req,
        resolve,
        enqueuedAtMs: Date.now(),
        deadlineMs: Date.now() + Math.max(0, timeoutMs),
      };
      // High-priority requests jump the queue but never pre-empt an
      // existing lease (no forced cancellation — fail-safe).
      const priority = req.priority ?? 0;
      if (priority > 0) {
        const idx = this.queue.findIndex(
          (p) => (p.req.priority ?? 0) < priority,
        );
        if (idx === -1) this.queue.push(pending);
        else this.queue.splice(idx, 0, pending);
      } else {
        this.queue.push(pending);
      }

      // Deadline timer — never blocks process exit.
      const timer = setTimeout(() => {
        const i = this.queue.indexOf(pending);
        if (i >= 0) {
          this.queue.splice(i, 1);
          this.sessionTotals.rejected++;
          resolve(null);
        }
      }, Math.max(0, timeoutMs));
      if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
        (timer as unknown as { unref: () => void }).unref();
      }
    });
  }

  /** Release a previously-granted lease. Unknown ids are a no-op. */
  release(leaseId: string): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    this.cpuUsed = Math.max(0, this.cpuUsed - lease.cpu);
    this.gpuUsed = Math.max(0, this.gpuUsed - lease.gpu);
    this.leases.delete(leaseId);
    this.sessionTotals.released++;
    this.drainQueue();
    return true;
  }

  /** After a release (or configuration change), serve queued requests. */
  private drainQueue(): void {
    // Walk queue once; serve whatever fits.
    const stillPending: PendingRequest[] = [];
    for (const p of this.queue) {
      if (Date.now() > p.deadlineMs) {
        this.sessionTotals.rejected++;
        p.resolve(null);
        continue;
      }
      const lease = this.tryAcquire(p.req);
      if (lease) {
        p.resolve(lease);
      } else {
        stillPending.push(p);
      }
    }
    this.queue = stillPending;
  }

  // ---- Simulation toggle & introspection ----

  setSimulation(enabled: boolean): ResourceBrokerSnapshot {
    const was = this.simulationEnabled;
    this.simulationEnabled = enabled;
    if (enabled && this.gpuTotal === 0) {
      this.gpuTotal = 4;
    } else if (!enabled && was) {
      // Returning to "no GPU" is only safe when no simulated GPUs are leased.
      if (this.gpuUsed === 0) {
        this.gpuTotal = 0;
      } else {
        this.logger.warn(
          'Cannot release simulated GPU pool while leases hold GPUs; deferred.',
        );
      }
    }
    return this.snapshot();
  }

  getSimulationEnabled(): boolean {
    return this.simulationEnabled;
  }

  snapshot(): ResourceBrokerSnapshot {
    const { cpuUsagePct, memUsagePct } = this.sample();
    return {
      budgetPct: this.budgetPct,
      cpuUsagePct,
      memUsagePct,
      cpu: {
        total: this.cpuTotal,
        used: this.cpuUsed,
        free: Math.max(0, this.cpuCap() - this.cpuUsed),
      },
      gpu: {
        total: this.gpuTotal,
        used: this.gpuUsed,
        free: Math.max(0, this.gpuCap() - this.gpuUsed),
      },
      leases: Array.from(this.leases.values()),
      queueDepth: this.queue.length,
      simulationEnabled: this.simulationEnabled,
      sessionTotals: { ...this.sessionTotals },
    };
  }

  /** TEST-ONLY: reset counters + drop all leases + empty queue. */
  __reset(): void {
    for (const p of this.queue) p.resolve(null);
    this.queue = [];
    this.leases.clear();
    this.cpuUsed = 0;
    this.gpuUsed = 0;
    this.sessionTotals = { acquired: 0, rejected: 0, released: 0 };
  }

  private clamp(v: number, lo: number, hi: number): number {
    if (!Number.isFinite(v)) return lo;
    return Math.min(hi, Math.max(lo, v));
  }
}
