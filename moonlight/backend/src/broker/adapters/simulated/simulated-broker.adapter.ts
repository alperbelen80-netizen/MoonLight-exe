import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BrokerAdapterInterface } from '../broker-adapter.interface';
import {
  BrokerOrderRequestDTO,
  BrokerOrderAckDTO,
  BrokerOrderStatus,
} from '../../../shared/dto/broker-order.dto';
import {
  BrokerPositionDTO,
  BrokerPositionStatus,
} from '../../../shared/dto/broker-position.dto';
import { SessionHealth } from '../../../shared/enums/session-health.enum';
import {
  DeterministicPrng,
  SeededPrng,
  gaussianSample,
} from '../../../shared/utils/deterministic-prng';
import {
  BrokerHealthRegistryService,
  BrokerId,
} from '../../health/broker-health-registry.service';

/**
 * BrokerSimProfile
 *
 * Execution characteristics of a simulated venue. Keeps each broker
 * recognizable without connecting to the real world (V2.5-2 scope).
 *
 * All units:
 *  - latencyMs      : round-trip order-ack latency (gaussian, clamped >= 0)
 *  - slippagePct    : price slippage around the quoted mid
 *  - rejectionProb  : probability sendOrder is rejected pre-fill
 *  - payoutBase     : base win payout multiplier (e.g. 0.85 = 85%)
 *  - payoutJitter   : payout ± range per symbol+expiry
 *  - sessionFlakeProb: probability session drops while a tick would be emitted
 */
export interface BrokerSimProfile {
  latencyMeanMs: number;
  latencyStdMs: number;
  latencyMaxMs: number;
  slippageMeanPct: number;
  slippageStdPct: number;
  rejectionProb: number;
  payoutBase: number;
  payoutJitter: number;
  sessionFlakeProb: number;
  basePriceMap?: Record<string, number>;
}

/**
 * Built-in profiles per broker. Numbers chosen to roughly mirror real-world
 * order of magnitude (IQ is fastest, Binomo slowest, etc.) and are wholly
 * tunable via simulator.configure().
 */
export const DEFAULT_SIM_PROFILES: Record<BrokerId, BrokerSimProfile> = {
  IQ_OPTION: {
    latencyMeanMs: 180,
    latencyStdMs: 45,
    latencyMaxMs: 1500,
    slippageMeanPct: 0.0004,
    slippageStdPct: 0.0002,
    rejectionProb: 0.02,
    payoutBase: 0.86,
    payoutJitter: 0.02,
    sessionFlakeProb: 0.005,
  },
  OLYMP_TRADE: {
    latencyMeanMs: 260,
    latencyStdMs: 70,
    latencyMaxMs: 2500,
    slippageMeanPct: 0.0006,
    slippageStdPct: 0.0003,
    rejectionProb: 0.03,
    payoutBase: 0.82,
    payoutJitter: 0.03,
    sessionFlakeProb: 0.01,
  },
  BINOMO: {
    latencyMeanMs: 340,
    latencyStdMs: 95,
    latencyMaxMs: 3500,
    slippageMeanPct: 0.0008,
    slippageStdPct: 0.0004,
    rejectionProb: 0.05,
    payoutBase: 0.78,
    payoutJitter: 0.04,
    sessionFlakeProb: 0.015,
  },
  EXPERT_OPTION: {
    latencyMeanMs: 290,
    latencyStdMs: 80,
    latencyMaxMs: 3000,
    slippageMeanPct: 0.0007,
    slippageStdPct: 0.0003,
    rejectionProb: 0.04,
    payoutBase: 0.8,
    payoutJitter: 0.03,
    sessionFlakeProb: 0.012,
  },
  FAKE: {
    latencyMeanMs: 50,
    latencyStdMs: 10,
    latencyMaxMs: 200,
    slippageMeanPct: 0,
    slippageStdPct: 0,
    rejectionProb: 0,
    payoutBase: 0.9,
    payoutJitter: 0,
    sessionFlakeProb: 0,
  },
};

const DEFAULT_BASE_PRICES: Record<string, number> = {
  BTCUSD: 68500,
  BTCUSDT: 68500,
  ETHUSD: 3420,
  ETHUSDT: 3420,
  XAUUSD: 2035,
  EURUSD: 1.08,
  GBPUSD: 1.27,
  AUDUSD: 0.65,
  USDJPY: 152.5,
  USDCAD: 1.37,
};

export interface SimulatedBrokerState {
  brokerId: BrokerId;
  seed: number;
  profile: BrokerSimProfile;
  health: SessionHealth;
  connectedAccounts: string[];
  openPositions: number;
  lastLatencyMs: number | null;
  ordersSent: number;
  ordersAck: number;
  ordersRejected: number;
  ordersTimedOut: number;
  lastSeedStepsConsumed: number;
}

/**
 * SimulatedBrokerAdapter (V2.5-2)
 *
 * Single reusable adapter class that can impersonate any of the four
 * quad-core brokers (or FAKE). It is deterministic when given a seed,
 * so contract tests and replay sessions produce bit-for-bit identical
 * results on every run.
 *
 * NOT a Nest provider by itself — BrokerModule instantiates five
 * singletons (one per broker id) through a factory provider.
 */
export class SimulatedBrokerAdapter implements BrokerAdapterInterface {
  private readonly logger: Logger;
  private readonly brokerId: BrokerId;
  private profile: BrokerSimProfile;
  private prng: SeededPrng;
  private seed: number;
  private health: SessionHealth = SessionHealth.DOWN;
  private lastLatencyMs: number | null = null;
  private readonly connectedAccounts: Set<string> = new Set();
  private readonly openPositions: Map<string, BrokerPositionDTO> = new Map();
  private readonly balances: Map<string, number> = new Map();
  private ordersSent = 0;
  private ordersAck = 0;
  private ordersRejected = 0;
  private ordersTimedOut = 0;
  private prngStepsBefore = 0;

  constructor(
    brokerId: BrokerId,
    private readonly healthRegistry: BrokerHealthRegistryService | null,
    seed?: number,
    profileOverride?: Partial<BrokerSimProfile>,
  ) {
    this.brokerId = brokerId;
    this.logger = new Logger(`SimulatedBrokerAdapter[${brokerId}]`);
    const defaultProfile = DEFAULT_SIM_PROFILES[brokerId];
    this.profile = { ...defaultProfile, ...(profileOverride || {}) };
    this.seed = this.resolveSeed(seed);
    this.prng = new DeterministicPrng(this.seed);
  }

  private resolveSeed(seed?: number): number {
    if (typeof seed === 'number' && Number.isFinite(seed)) return seed;
    const fromEnv = process.env.BROKER_SIM_SEED;
    if (fromEnv) {
      const n = Number(fromEnv);
      if (Number.isFinite(n)) return n;
      return DeterministicPrng.seedFromString(fromEnv);
    }
    // Per-broker seed so different brokers yield different series by default.
    return DeterministicPrng.seedFromString(`moonlight::${this.brokerId}::v2.5-2`);
  }

  // BrokerAdapterInterface --------------------------------------------------

  getBrokerId(): string {
    return this.brokerId;
  }

  getSessionHealth(): SessionHealth {
    return this.health;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  async connectSession(accountId: string): Promise<void> {
    this.safeTransition('CONNECTING', 'simulator.connect');
    // Simulate a small handshake delay deterministically.
    const d = Math.max(
      0,
      Math.min(this.profile.latencyMaxMs, this.profile.latencyMeanMs / 2),
    );
    await new Promise((r) => setTimeout(r, d));
    this.safeTransition('AUTHENTICATING', 'simulator.auth');
    this.connectedAccounts.add(accountId);
    this.balances.set(accountId, this.balances.get(accountId) ?? 10_000);
    this.health = SessionHealth.UP;
    this.safeTransition('READY', 'simulator.ready');
    this.logger.log(`Session UP for ${accountId} (sim)`);
  }

  async disconnectSession(accountId: string): Promise<void> {
    this.connectedAccounts.delete(accountId);
    if (this.connectedAccounts.size === 0) {
      this.health = SessionHealth.DOWN;
      this.safeTransition('DISCONNECTED', 'simulator.disconnect');
    }
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    this.ordersSent++;
    this.prngStepsBefore = this.ordersSent;

    // Fail-closed: reject when session is not UP (mirrors real adapter semantics).
    if (this.health !== SessionHealth.UP) {
      this.ordersRejected++;
      return this.rejectAck(request, 0, 'SESSION_DOWN', `session is ${this.health}`);
    }

    // Deterministic latency sample (gaussian, clamped to profile.latencyMaxMs).
    let latency = gaussianSample(
      this.prng,
      this.profile.latencyMeanMs,
      this.profile.latencyStdMs,
    );
    latency = Math.max(0, Math.min(this.profile.latencyMaxMs, latency));
    // In tests/simulation we DON'T actually sleep for the full latency — we
    // stamp it on the ack. For realism during live preview, operators can
    // opt-in via BROKER_SIM_REAL_LATENCY=true.
    if (process.env.BROKER_SIM_REAL_LATENCY === 'true') {
      await new Promise((r) => setTimeout(r, latency));
    }
    this.lastLatencyMs = Math.round(latency);
    if (this.healthRegistry) {
      this.healthRegistry.recordOrderLatency(this.brokerId, this.lastLatencyMs);
    }

    // Deterministic rejection roll.
    if (this.prng.nextBool(this.profile.rejectionProb)) {
      this.ordersRejected++;
      return this.rejectAck(
        request,
        this.lastLatencyMs,
        'SIM_REJECT',
        'deterministic simulator rejection',
      );
    }

    // Timeout roll (sub-fraction of rejections to keep FSM honest).
    if (this.prng.nextBool(this.profile.rejectionProb / 4)) {
      this.ordersTimedOut++;
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'TIMEOUT',
        status: BrokerOrderStatus.TIMEOUT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: this.lastLatencyMs,
        reject_code: 'SIM_TIMEOUT',
        reject_message: 'deterministic simulator timeout',
      };
    }

    // ACK path — compute open price with slippage.
    const basePrice = this.resolveBasePrice(request.symbol);
    const slip = gaussianSample(
      this.prng,
      this.profile.slippageMeanPct,
      this.profile.slippageStdPct,
    );
    const openPrice = basePrice * (1 + slip);

    const positionId = `${this.brokerId}_POS_${uuidv4()}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + request.expiry_minutes * 60_000);

    const position: BrokerPositionDTO = {
      position_id: positionId,
      symbol: request.symbol,
      direction: request.direction,
      stake_amount: request.stake_amount,
      entry_price: openPrice,
      open_ts_utc: now.toISOString(),
      expiry_ts_utc: expiry.toISOString(),
      status: BrokerPositionStatus.OPEN,
    };
    this.openPositions.set(positionId, position);
    this.ordersAck++;

    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: positionId,
      status: BrokerOrderStatus.ACK,
      response_ts_utc: now.toISOString(),
      latency_ms: this.lastLatencyMs,
      open_price: openPrice,
      open_ts_utc: position.open_ts_utc,
    };
  }

  async getOpenPositions(_accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.openPositions.values());
  }

  async getBalance(accountId: string): Promise<number> {
    return this.balances.get(accountId) ?? 0;
  }

  async getPayoutRatio(symbol: string, expiryMinutes: number): Promise<number | null> {
    // Deterministic — seed payout sampling by (symbol, expiry) so the same
    // pair returns a stable value across calls within a run.
    const localSeed = DeterministicPrng.seedFromString(
      `${this.brokerId}:${symbol}:${expiryMinutes}`,
    );
    const localPrng = new DeterministicPrng(this.seed ^ localSeed);
    const jitter =
      (localPrng.next() * 2 - 1) * this.profile.payoutJitter;
    const payout = Math.max(0, Math.min(1, this.profile.payoutBase + jitter));
    return payout;
  }

  // Simulator admin surface -------------------------------------------------

  /** Resets all in-memory state + resets PRNG to the original seed. */
  reset(): SimulatedBrokerState {
    this.prng = new DeterministicPrng(this.seed);
    this.openPositions.clear();
    this.balances.clear();
    this.connectedAccounts.clear();
    this.ordersSent = 0;
    this.ordersAck = 0;
    this.ordersRejected = 0;
    this.ordersTimedOut = 0;
    this.lastLatencyMs = null;
    this.health = SessionHealth.DOWN;
    this.safeTransition('DISCONNECTED', 'simulator.reset');
    return this.snapshot();
  }

  /** Apply a new seed + optional profile overrides + (optional) reset. */
  configure(config: {
    seed?: number;
    profile?: Partial<BrokerSimProfile>;
    reset?: boolean;
  }): SimulatedBrokerState {
    if (typeof config.seed === 'number') {
      this.seed = config.seed;
    }
    if (config.profile) {
      this.profile = { ...this.profile, ...config.profile };
    }
    if (config.reset !== false) {
      this.reset();
    } else {
      this.prng = new DeterministicPrng(this.seed);
    }
    return this.snapshot();
  }

  snapshot(): SimulatedBrokerState {
    return {
      brokerId: this.brokerId,
      seed: this.seed,
      profile: { ...this.profile },
      health: this.health,
      connectedAccounts: Array.from(this.connectedAccounts),
      openPositions: this.openPositions.size,
      lastLatencyMs: this.lastLatencyMs,
      ordersSent: this.ordersSent,
      ordersAck: this.ordersAck,
      ordersRejected: this.ordersRejected,
      ordersTimedOut: this.ordersTimedOut,
      lastSeedStepsConsumed: this.prngStepsBefore,
    };
  }

  // Internals ---------------------------------------------------------------

  private rejectAck(
    request: BrokerOrderRequestDTO,
    latency: number,
    code: string,
    message: string,
  ): BrokerOrderAckDTO {
    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: 'REJECTED',
      status: BrokerOrderStatus.REJECT,
      response_ts_utc: new Date().toISOString(),
      latency_ms: latency,
      reject_code: code,
      reject_message: message,
    };
  }

  private resolveBasePrice(symbol: string): number {
    const from = this.profile.basePriceMap?.[symbol];
    if (typeof from === 'number') return from;
    return DEFAULT_BASE_PRICES[symbol] ?? 100;
  }

  private safeTransition(
    next:
      | 'CONNECTING'
      | 'AUTHENTICATING'
      | 'READY'
      | 'THROTTLED'
      | 'ERRORED'
      | 'DISABLED'
      | 'DISCONNECTED',
    reason: string,
  ): void {
    if (!this.healthRegistry) return;
    this.healthRegistry.transition(this.brokerId, next, reason);
  }
}

/**
 * Factory-friendly injection token per broker id. BrokerModule uses these
 * to register the five SimulatedBrokerAdapter singletons via `useFactory`.
 */
export const SIMULATED_BROKER_TOKENS: Record<BrokerId, string> = {
  IQ_OPTION: 'SIM_BROKER_IQ_OPTION',
  OLYMP_TRADE: 'SIM_BROKER_OLYMP_TRADE',
  BINOMO: 'SIM_BROKER_BINOMO',
  EXPERT_OPTION: 'SIM_BROKER_EXPERT_OPTION',
  FAKE: 'SIM_BROKER_FAKE',
};

/**
 * Central registry for all active sim adapters. Used by the sim control
 * REST surface (reset / configure / state).
 */
@Injectable()
export class BrokerSimRegistry {
  private readonly logger = new Logger(BrokerSimRegistry.name);
  private readonly adapters: Map<BrokerId, SimulatedBrokerAdapter> = new Map();

  register(adapter: SimulatedBrokerAdapter): void {
    const id = adapter.getBrokerId() as BrokerId;
    this.adapters.set(id, adapter);
    this.logger.log(`registered sim adapter for ${id}`);
  }

  get(brokerId: BrokerId): SimulatedBrokerAdapter | null {
    return this.adapters.get(brokerId) ?? null;
  }

  list(): SimulatedBrokerAdapter[] {
    return Array.from(this.adapters.values());
  }

  listSnapshots(): SimulatedBrokerState[] {
    return this.list().map((a) => a.snapshot());
  }

  resetAll(): SimulatedBrokerState[] {
    return this.list().map((a) => a.reset());
  }
}
