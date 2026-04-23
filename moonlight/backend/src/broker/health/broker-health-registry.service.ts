// MoonLight V2.4-D — Broker Health Registry.
//
// Central source of truth for "is broker X reachable / ready / throttled?".
// Each adapter reports its state transitions here; MoE context, routing,
// and the Trinity UI read from this single registry.
//
// This is intentionally light-weight: pure in-memory state machine with
// timestamps. Durable history goes to a separate table in V2.5.

import { Injectable, Logger } from '@nestjs/common';

export type BrokerId = 'IQ_OPTION' | 'OLYMP_TRADE' | 'BINOMO' | 'EXPERT_OPTION' | 'FAKE';

export type BrokerState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'READY'
  | 'THROTTLED'
  | 'ERRORED'
  | 'DISABLED';

export interface BrokerHealthSnapshot {
  brokerId: BrokerId;
  state: BrokerState;
  lastTransitionAt: string;
  reason?: string;
  quotesLastSeenAt?: string;
  orderLatencyMsP95?: number;
  errorsLastHour: number;
}

const VALID_TRANSITIONS: Record<BrokerState, BrokerState[]> = {
  DISCONNECTED: ['CONNECTING', 'DISABLED'],
  CONNECTING: ['AUTHENTICATING', 'ERRORED', 'DISCONNECTED'],
  AUTHENTICATING: ['READY', 'ERRORED', 'DISCONNECTED'],
  READY: ['THROTTLED', 'ERRORED', 'DISCONNECTED'],
  THROTTLED: ['READY', 'ERRORED', 'DISCONNECTED'],
  ERRORED: ['CONNECTING', 'DISABLED', 'DISCONNECTED'],
  DISABLED: ['DISCONNECTED'],
};

@Injectable()
export class BrokerHealthRegistryService {
  private readonly logger = new Logger(BrokerHealthRegistryService.name);
  private readonly state = new Map<BrokerId, BrokerHealthSnapshot>();
  private errorLog: { brokerId: BrokerId; at: number }[] = [];

  constructor() {
    // Initialize all 4 real brokers + fake in DISCONNECTED state.
    const brokers: BrokerId[] = ['IQ_OPTION', 'OLYMP_TRADE', 'BINOMO', 'EXPERT_OPTION', 'FAKE'];
    for (const b of brokers) {
      this.state.set(b, {
        brokerId: b,
        state: b === 'FAKE' ? 'READY' : 'DISCONNECTED',
        lastTransitionAt: new Date().toISOString(),
        errorsLastHour: 0,
      });
    }
  }

  get(brokerId: BrokerId): BrokerHealthSnapshot | null {
    return this.state.get(brokerId) || null;
  }

  list(): BrokerHealthSnapshot[] {
    this.pruneErrors();
    return Array.from(this.state.values()).map((s) => ({
      ...s,
      errorsLastHour: this.errorLog.filter((e) => e.brokerId === s.brokerId).length,
    }));
  }

  /**
   * Attempt a state transition. Returns true if accepted.
   * Invalid transitions are logged + rejected (stays in previous state).
   */
  transition(brokerId: BrokerId, next: BrokerState, reason?: string): boolean {
    const current = this.state.get(brokerId);
    if (!current) return false;
    if (current.state === next) {
      // Idempotent self-transition: refresh reason but keep stamp.
      current.reason = reason;
      return true;
    }
    const allowed = VALID_TRANSITIONS[current.state] || [];
    if (!allowed.includes(next)) {
      this.logger.warn(
        `Invalid transition ${brokerId}: ${current.state} → ${next} (allowed: ${allowed.join(',')})`,
      );
      return false;
    }
    current.state = next;
    current.lastTransitionAt = new Date().toISOString();
    current.reason = reason;
    if (next === 'ERRORED') this.logError(brokerId);
    return true;
  }

  recordQuoteSeen(brokerId: BrokerId): void {
    const s = this.state.get(brokerId);
    if (s) s.quotesLastSeenAt = new Date().toISOString();
  }

  recordOrderLatency(brokerId: BrokerId, p95Ms: number): void {
    const s = this.state.get(brokerId);
    if (s) s.orderLatencyMsP95 = Math.round(p95Ms);
  }

  private logError(brokerId: BrokerId): void {
    this.errorLog.push({ brokerId, at: Date.now() });
  }

  private pruneErrors(): void {
    const hourAgo = Date.now() - 3600_000;
    this.errorLog = this.errorLog.filter((e) => e.at > hourAgo);
  }
}
