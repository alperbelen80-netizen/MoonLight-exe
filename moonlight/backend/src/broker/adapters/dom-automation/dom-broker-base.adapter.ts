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
  VersionedSelectorBundle,
} from './dom-base';

/**
 * V2.5-4 Base DOM Broker Adapter
 *
 * Common skeleton for Olymp / Binomo / Expert DOM-automation adapters.
 *
 * Fail-safe semantics (unchanged by this phase):
 *   - If `BROKER_DOM_AUTOMATION_ENABLED` is not "true" → connectSession()
 *     throws `DOM_AUTOMATION_DISABLED` so the router falls back to the
 *     simulated adapter for this brokerId.
 *   - If the selector registry has no bundle for this broker → treated as
 *     DISABLED (broker health flips to DISABLED + audit log).
 *   - `sendOrder()` in dry-run mode does NOT actually click the confirm
 *     button; it verifies the full selector chain can be reached and
 *     reports ACK with a synthetic position id prefixed `DOM_DRYRUN_*`.
 *     Real clicks require `BROKER_DOM_LIVE_ORDERS=true` (opt-in beyond
 *     the automation flag).
 */
export abstract class DomBrokerAdapterBase implements BrokerAdapterInterface {
  protected readonly logger: Logger;
  protected session: DomSession | null = null;
  protected health: SessionHealth = SessionHealth.DOWN;
  protected lastLatencyMs: number | null = null;
  protected readonly positions: Map<string, BrokerPositionDTO> = new Map();

  constructor(
    protected readonly brokerId: BrokerId,
    protected readonly sessions: DomBrowserSessionManager,
    protected readonly selectors: SelectorRegistry,
    protected readonly healthRegistry: BrokerHealthRegistryService,
  ) {
    this.logger = new Logger(`DomBrokerAdapter[${brokerId}]`);
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
    const bundle = this.selectors.get(this.brokerId);
    if (!bundle) {
      return this.reject(
        request,
        0,
        'SELECTOR_BUNDLE_MISSING',
        'no selector bundle registered',
      );
    }

    try {
      await this.stageOrder(this.session.page, bundle, request);
      const latency = Date.now() - start;
      this.lastLatencyMs = latency;
      this.healthRegistry.recordOrderLatency(this.brokerId, latency);

      // Live click path is gated behind a second opt-in flag — we default
      // to dry-run so operators must explicitly commit to real trades.
      const live = process.env.BROKER_DOM_LIVE_ORDERS === 'true';
      if (!live) {
        const positionId = `DOM_DRYRUN_${this.brokerId}_${uuidv4()}`;
        const now = new Date();
        const quote = (await this.readQuote(
          this.session.page,
          bundle,
          request.symbol,
        )) ?? 0;
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

      // Live click: subclasses may override stageOrder to also confirm; if
      // not, we treat this as unsupported rather than silently dry-running.
      return this.reject(
        request,
        latency,
        'DOM_LIVE_UNSUPPORTED',
        'live click flow not implemented for this broker (dry-run only)',
      );
    } catch (err) {
      const latency = Date.now() - start;
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

  async getOpenPositions(_accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.positions.values());
  }

  async getBalance(_accountId: string): Promise<number> {
    // Base implementation: DOM balance read is broker-specific. Subclasses
    // can override. Returning 0 (no throw) keeps this safe in mixed-session
    // reconciliation contexts.
    return 0;
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
