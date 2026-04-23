import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  BrokerAdapterInterface,
} from '../broker-adapter.interface';
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
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';
import {
  BrokerHealthRegistryService,
  BrokerId,
} from '../../health/broker-health-registry.service';
import {
  DomBrowserSessionManager,
  DomSession,
  SelectorRegistry,
  SelectorDriftGuard,
  VersionedSelectorBundle,
} from './dom-base';

/**
 * V2.6-5-B Hardened DOM Broker Adapter Base
 *
 * Common skeleton for Olymp / Binomo / Expert DOM-automation adapters.
 *
 * Fail-safe semantics:
 *   - `BROKER_DOM_AUTOMATION_ENABLED` must be "true" → otherwise throws
 *     `DOM_AUTOMATION_DISABLED` at connect time.
 *   - `SELECTOR_BUNDLE_MISSING` → DISABLED.
 *   - Soft-disable via `SelectorDriftGuard` after N consecutive
 *     selector misses (per broker) — adapter refuses `stageOrder`
 *     until the operator updates selectors and calls reset.
 *   - Live click path requires:
 *       * `BROKER_DOM_LIVE_ORDERS=true` (second opt-in)
 *       * Pre-flight safety: demo badge detected OR explicit
 *         `BROKER_DOM_ALLOW_LIVE_REAL=true` override.
 *       * `confirmButton` selector present in bundle.
 *       * `request.stake_amount <= BROKER_DOM_MAX_STAKE` (default 25).
 *     Any failure returns a REJECT with a clear code.
 */
export abstract class DomBrokerAdapterBase implements BrokerAdapterInterface {
  protected readonly logger: Logger;
  protected session: DomSession | null = null;
  protected health: SessionHealth = SessionHealth.DOWN;
  protected lastLatencyMs: number | null = null;
  protected readonly positions: Map<string, BrokerPositionDTO> = new Map();
  // v2.6-5-B: optional drift guard injected by the module. If absent the
  // adapter behaves as before (no soft-disable).
  protected drift: SelectorDriftGuard | null = null;
  protected lastBalance: number | null = null;
  protected lastDemoCheckAt: number | null = null;
  protected lastDemoVerified: boolean | null = null;

  constructor(
    protected readonly brokerId: BrokerId,
    protected readonly sessions: DomBrowserSessionManager,
    protected readonly selectors: SelectorRegistry,
    protected readonly healthRegistry: BrokerHealthRegistryService,
  ) {
    this.logger = new Logger(`DomBrokerAdapter[${brokerId}]`);
  }

  /** v2.6-5-B: wire a SelectorDriftGuard after DI. */
  setDriftGuard(guard: SelectorDriftGuard): void {
    this.drift = guard;
  }

  getBrokerId(): string {
    return this.brokerId;
  }

  getSessionHealth(): SessionHealth {
    return this.health;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  getLastBalance(): number | null {
    return this.lastBalance;
  }

  /** Structured runtime diagnostics for the Owner Console. */
  getRuntimeDiagnostics(): {
    brokerId: string;
    health: SessionHealth;
    softDisabled: boolean;
    lastBalance: number | null;
    lastDemoVerified: boolean | null;
    lastDemoCheckAt: number | null;
    positions: number;
    lastLatencyMs: number | null;
  } {
    return {
      brokerId: this.brokerId,
      health: this.health,
      softDisabled: this.drift?.isSoftDisabled(this.brokerId) ?? false,
      lastBalance: this.lastBalance,
      lastDemoVerified: this.lastDemoVerified,
      lastDemoCheckAt: this.lastDemoCheckAt,
      positions: this.positions.size,
      lastLatencyMs: this.lastLatencyMs,
    };
  }

  // ---- Subclass contract --------------------------------------------------

  protected abstract performLogin(
    page: DomSession['page'],
    bundle: VersionedSelectorBundle,
  ): Promise<void>;

  /** Returns the last known mid-price for a symbol (from DOM text). */
  protected abstract readQuote(
    page: DomSession['page'],
    bundle: VersionedSelectorBundle,
    symbol: string,
  ): Promise<number | null>;

  /** Performs the pre-click chain up to (but NOT including) confirm. */
  protected abstract stageOrder(
    page: DomSession['page'],
    bundle: VersionedSelectorBundle,
    request: BrokerOrderRequestDTO,
  ): Promise<void>;

  // ---- BrokerAdapterInterface ---------------------------------------------

  async connectSession(_accountId: string): Promise<void> {
    if (!this.sessions.isEnabled()) {
      this.health = SessionHealth.DOWN;
      this.healthRegistry.transition(
        this.brokerId,
        'DISABLED',
        'BROKER_DOM_AUTOMATION_DISABLED',
      );
      throw new Error('DOM_AUTOMATION_DISABLED');
    }
    const bundle = this.selectors.get(this.brokerId);
    if (!bundle) {
      this.health = SessionHealth.DOWN;
      this.healthRegistry.transition(
        this.brokerId,
        'DISABLED',
        'SELECTOR_BUNDLE_MISSING',
      );
      throw new Error('SELECTOR_BUNDLE_MISSING');
    }
    this.healthRegistry.transition(this.brokerId, 'CONNECTING', 'dom.open');
    try {
      this.session = await this.sessions.open(this.brokerId);
      await this.session.page.goto(bundle.loginUrl);
      this.healthRegistry.transition(
        this.brokerId,
        'AUTHENTICATING',
        'dom.login',
      );
      await this.performLogin(this.session.page, bundle);
      this.health = SessionHealth.UP;
      this.healthRegistry.transition(this.brokerId, 'READY', 'dom.ready');
      this.logger.log('DOM session READY');
    } catch (err) {
      this.logger.error(`connectSession failed: ${(err as Error).message}`);
      this.healthRegistry.transition(
        this.brokerId,
        'ERRORED',
        `connect_failed:${(err as Error).message}`,
      );
      if (this.session) {
        try {
          await this.sessions.close(this.session.id);
        } catch {
          /* ignore */
        }
        this.session = null;
      }
      this.health = SessionHealth.DOWN;
      throw err;
    }
  }

  async disconnectSession(_accountId: string): Promise<void> {
    if (this.session) {
      try {
        await this.sessions.close(this.session.id);
      } catch {
        /* ignore */
      }
      this.session = null;
    }
    this.health = SessionHealth.DOWN;
    this.healthRegistry.transition(
      this.brokerId,
      'DISCONNECTED',
      'dom.disconnect',
    );
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const start = Date.now();
    if (!this.sessions.isEnabled() || !this.session || this.health !== SessionHealth.UP) {
      return this.reject(
        request,
        0,
        'DOM_NOT_READY',
        `session not ready (health=${this.health})`,
      );
    }
    // v2.6-5-B: respect selector-drift soft-disable.
    if (this.drift?.isSoftDisabled(this.brokerId)) {
      return this.reject(
        request,
        0,
        'DOM_SOFT_DISABLED',
        `${this.brokerId} soft-disabled by SelectorDriftGuard — update selectors and reset`,
      );
    }
    const bundle = this.selectors.get(this.brokerId);
    if (!bundle) {
      return this.reject(
        request,
        0,
        'SELECTOR_BUNDLE_MISSING',
        'no selector bundle registered',
      );
    }

    // v2.6-5-B: pre-flight safety gate — only run when operator actually
    // wants to go live. Keep dry-run path fast and cheap.
    const live = process.env.BROKER_DOM_LIVE_ORDERS === 'true';
    if (live) {
      const check = await this.preflightLive(bundle, request);
      if (check) return check; // pre-flight returned a REJECT
    }

    try {
      await this.stageOrder(this.session.page, bundle, request);
      this.drift?.recordHit(this.brokerId, 'stakeInput');
      const latency = Date.now() - start;
      this.lastLatencyMs = latency;
      this.healthRegistry.recordOrderLatency(this.brokerId, latency);

      const quote = (await this.readQuote(
        this.session.page,
        bundle,
        request.symbol,
      )) ?? 0;
      const now = new Date();

      if (!live) {
        // Dry-run ACK (legacy path) — no real click.
        const positionId = `DOM_DRYRUN_${this.brokerId}_${uuidv4()}`;
        const position: BrokerPositionDTO = {
          position_id: positionId,
          symbol: request.symbol,
          direction: request.direction,
          stake_amount: request.stake_amount,
          entry_price: quote,
          open_ts_utc: now.toISOString(),
          expiry_ts_utc: new Date(
            now.getTime() + request.expiry_minutes * 60_000,
          ).toISOString(),
          status: BrokerPositionStatus.OPEN,
        };
        this.positions.set(positionId, position);
        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: positionId,
          status: BrokerOrderStatus.ACK,
          response_ts_utc: now.toISOString(),
          latency_ms: latency,
          open_price: quote,
          open_ts_utc: position.open_ts_utc,
        };
      }

      // v2.6-5-B: LIVE CLICK path.
      const confirmSel = bundle.selectors.confirmButton;
      if (!confirmSel) {
        return this.reject(
          request,
          latency,
          'DOM_LIVE_UNSUPPORTED',
          'confirmButton selector missing — cannot commit trade safely',
        );
      }
      try {
        await this.session.page.waitForSelector(confirmSel, { timeout: 3_000 });
        await this.session.page.click(confirmSel, { timeout: 3_000 });
        this.drift?.recordHit(this.brokerId, 'confirmButton');
      } catch (err) {
        this.drift?.recordMiss(
          this.brokerId,
          'confirmButton',
          confirmSel,
          (err as Error).message,
        );
        return this.reject(
          request,
          Date.now() - start,
          'DOM_CONFIRM_FAILED',
          (err as Error).message,
        );
      }

      const livePositionId = `DOM_LIVE_${this.brokerId}_${uuidv4()}`;
      const livePosition: BrokerPositionDTO = {
        position_id: livePositionId,
        symbol: request.symbol,
        direction: request.direction,
        stake_amount: request.stake_amount,
        entry_price: quote,
        open_ts_utc: now.toISOString(),
        expiry_ts_utc: new Date(
          now.getTime() + request.expiry_minutes * 60_000,
        ).toISOString(),
        status: BrokerPositionStatus.OPEN,
      };
      this.positions.set(livePositionId, livePosition);
      const finalLatency = Date.now() - start;
      this.lastLatencyMs = finalLatency;
      this.healthRegistry.recordOrderLatency(this.brokerId, finalLatency);
      this.logger.log(
        `LIVE order placed on ${this.brokerId}: ${request.direction} ${request.symbol} ${request.stake_amount} → ${livePositionId}`,
      );
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: livePositionId,
        status: BrokerOrderStatus.ACK,
        response_ts_utc: now.toISOString(),
        latency_ms: finalLatency,
        open_price: quote,
        open_ts_utc: livePosition.open_ts_utc,
      };
    } catch (err) {
      const latency = Date.now() - start;
      this.drift?.recordMiss(
        this.brokerId,
        'stageOrder',
        'stage_order_chain',
        (err as Error).message,
      );
      this.healthRegistry.transition(
        this.brokerId,
        'ERRORED',
        `send_order_failed:${(err as Error).message}`,
      );
      return this.reject(
        request,
        latency,
        'DOM_ERROR',
        (err as Error).message,
      );
    }
  }

  /**
   * v2.6-5-B: Pre-flight safety check before a LIVE click.
   *
   * Order of checks (any failure returns a REJECT Ack; otherwise null):
   *   1. `request.stake_amount` ≤ `BROKER_DOM_MAX_STAKE` (default 25 to
   *      cap accidental big trades).
   *   2. Demo account verification: the bundle's `demoBadge` selector
   *      must be present in the DOM, unless operator explicitly sets
   *      `BROKER_DOM_ALLOW_LIVE_REAL=true` (acknowledges real-money risk).
   *   3. Balance sanity: read `balanceDisplay` — if parseable and less
   *      than `request.stake_amount`, reject with INSUFFICIENT_BALANCE.
   *
   * Any step that fails to read the DOM is logged via `drift.recordMiss`
   * but does NOT automatically fail the pre-flight (operator intent +
   * explicit flags are what ultimately gate).
   */
  protected async preflightLive(
    bundle: VersionedSelectorBundle,
    request: BrokerOrderRequestDTO,
  ): Promise<BrokerOrderAckDTO | null> {
    if (!this.session) {
      return this.reject(request, 0, 'DOM_NOT_READY', 'no session');
    }
    const page = this.session.page;
    const maxStake = Number(process.env.BROKER_DOM_MAX_STAKE ?? '25');
    if (Number.isFinite(maxStake) && request.stake_amount > maxStake) {
      return this.reject(
        request,
        0,
        'DOM_MAX_STAKE_EXCEEDED',
        `stake ${request.stake_amount} > BROKER_DOM_MAX_STAKE ${maxStake}`,
      );
    }

    const allowReal = process.env.BROKER_DOM_ALLOW_LIVE_REAL === 'true';
    let demoVerified: boolean | null = null;
    if (bundle.selectors.demoBadge) {
      try {
        await page.waitForSelector(bundle.selectors.demoBadge, { timeout: 1_500 });
        demoVerified = true;
        this.drift?.recordHit(this.brokerId, 'demoBadge');
      } catch {
        demoVerified = false;
        this.drift?.recordMiss(
          this.brokerId,
          'demoBadge',
          bundle.selectors.demoBadge,
          'demoBadge not found within 1500ms',
        );
      }
    }
    this.lastDemoVerified = demoVerified;
    this.lastDemoCheckAt = Date.now();

    if (demoVerified === false && !allowReal) {
      return this.reject(
        request,
        0,
        'DOM_DEMO_UNVERIFIED',
        'demoBadge not found — refusing live click. Set BROKER_DOM_ALLOW_LIVE_REAL=true to override.',
      );
    }

    if (bundle.selectors.balanceDisplay) {
      try {
        const txt = await page.textContent(bundle.selectors.balanceDisplay);
        if (txt) {
          const n = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
          if (Number.isFinite(n)) {
            this.lastBalance = n;
            this.drift?.recordHit(this.brokerId, 'balanceDisplay');
            if (n < request.stake_amount) {
              return this.reject(
                request,
                0,
                'DOM_INSUFFICIENT_BALANCE',
                `balance ${n} < stake ${request.stake_amount}`,
              );
            }
          }
        }
      } catch (err) {
        this.drift?.recordMiss(
          this.brokerId,
          'balanceDisplay',
          bundle.selectors.balanceDisplay,
          (err as Error).message,
        );
      }
    }
    return null;
  }

  /** v2.6-5-B: read balance on-demand — used by dynamic payout + routing. */
  async getBalance(_accountId: string): Promise<number> {
    if (!this.session) return this.lastBalance ?? 0;
    const bundle = this.selectors.get(this.brokerId);
    if (!bundle?.selectors.balanceDisplay) return this.lastBalance ?? 0;
    try {
      const txt = await this.session.page.textContent(bundle.selectors.balanceDisplay);
      if (!txt) return this.lastBalance ?? 0;
      const n = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
      if (Number.isFinite(n)) {
        this.lastBalance = n;
        return n;
      }
    } catch {
      /* ignore */
    }
    return this.lastBalance ?? 0;
  }

  async getOpenPositions(_accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.positions.values());
  }

  // Helpers -----------------------------------------------------------------

  protected reject(
    request: BrokerOrderRequestDTO,
    latencyMs: number,
    code: string,
    message: string,
  ): BrokerOrderAckDTO {
    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: 'REJECTED',
      status: BrokerOrderStatus.REJECT,
      response_ts_utc: new Date().toISOString(),
      latency_ms: latencyMs,
      reject_code: code,
      reject_message: message,
    };
  }

  protected directionKey(d: SignalDirection): 'up' | 'down' {
    return d === SignalDirection.CALL ? 'up' : 'down';
  }
}
