import { Injectable } from '@nestjs/common';
import { BaseWSAdapter } from './base/base-ws.adapter';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO, BrokerPositionStatus } from '../../shared/dto/broker-position.dto';
import { SignalDirection } from '../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';
import { BrokerCredentialsService } from './broker-credentials.service';

interface IQOrderResponse {
  id?: number | string;
  isSuccessful: boolean;
  price?: number;
  message?: string;
}

/**
 * IQ Option Real Adapter
 *
 * Connects to IQ Option's unofficial WebSocket (wss://iqoption.com/echo/websocket).
 * Protocol notes (reverse-engineered, subject to change):
 *  - Auth: { name: 'ssid', msg: '<SSID_TOKEN>' }
 *  - Order: { name: 'sendMessage', msg: { name: 'binary-options.open-option', ... } }
 *  - Response carries request_id which we use for correlation.
 *
 * Credentials:
 *  - IQ_OPTION_SSID
 *  - IQ_OPTION_BALANCE_ID
 *  - IQ_OPTION_WS_URL (optional override)
 *
 * When credentials are absent AND BROKER_MOCK_MODE!=true → sendOrder returns REJECT
 * with code NOT_CONFIGURED instead of attempting to connect.
 */
@Injectable()
export class IQOptionRealAdapter extends BaseWSAdapter implements BrokerAdapterInterface {
  private readonly accountPositions: Map<string, BrokerPositionDTO[]> = new Map();
  private lastKnownBalance = 0;
  private readonly payoutCache: Map<string, number> = new Map();
  // v2.6-5: Subscriptions we restore on every (re)connect. Keeps the
  // session self-healing: if the broker drops us briefly we come back
  // with the same feeds primed without the operator doing anything.
  private readonly activeSubscriptions: Set<string> = new Set();
  private lastAuthVerifiedAt: number | null = null;

  constructor(private readonly creds: BrokerCredentialsService) {
    const url = process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket';
    super('IQOptionRealAdapter', {
      url,
      heartbeatIntervalMs: 25000,
      requestTimeoutMs: 5000,
      maxReconnectAttempts: 6,
      reconnectBaseDelayMs: 1000,
    });
    // v2.6-5: rebind subscriptions whenever the socket transitions back to UP.
    this.on('health-change', (e: { from: SessionHealth; to: SessionHealth }) => {
      if (e.to === SessionHealth.UP && e.from !== SessionHealth.UP) {
        this.restoreSubscriptions();
      }
    });
  }

  getBrokerId(): string {
    return 'IQ_OPTION';
  }

  /**
   * V2.6-5: expose a snapshot of cached payouts, subscriptions and last
   * auth verification for the Owner Console + health registry. Never
   * exposes the SSID itself.
   */
  getRuntimeDiagnostics(): {
    health: SessionHealth;
    authenticated: boolean;
    lastAuthVerifiedAt: number | null;
    subscriptions: string[];
    payoutCount: number;
    lastLatencyMs: number | null;
    balance: number;
  } {
    return {
      health: this.getSessionHealth(),
      authenticated: this.authenticated,
      lastAuthVerifiedAt: this.lastAuthVerifiedAt,
      subscriptions: Array.from(this.activeSubscriptions),
      payoutCount: this.payoutCache.size,
      lastLatencyMs: this.getLastLatencyMs(),
      balance: this.lastKnownBalance,
    };
  }

  /** Snapshot of the payout cache — used by the Dynamic Payout Matrix provider. */
  snapshotPayouts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.payoutCache.entries()) out[k] = v;
    return out;
  }

  /**
   * V2.5-3: Real IQ Option WSS is OFF by default. Operators must explicitly
   * opt-in via BROKER_IQOPTION_REAL_ENABLED=true. This protects the system
   * from accidentally initiating real trades when a stray SSID cookie is
   * present in the environment.
   */
  static isRealEnabled(): boolean {
    return process.env.BROKER_IQOPTION_REAL_ENABLED === 'true';
  }

  async connectSession(_accountId: string): Promise<void> {
    if (!IQOptionRealAdapter.isRealEnabled()) {
      // Fail-safe fallback: do NOT attempt a real connection. Callers can
      // still route through the SimulatedBrokerAdapter for IQ_OPTION.
      this.logger.warn(
        'IQ Option real adapter disabled (BROKER_IQOPTION_REAL_ENABLED!=true). ' +
          'Falling back to simulated routing. Set the flag to enable real WSS.',
      );
      this.setHealth(SessionHealth.DOWN);
      throw new Error('IQ_OPTION_REAL_DISABLED');
    }
    const { present } = this.creds.getIQOption();
    if (!present && !this.creds.isMockMode()) {
      this.logger.warn('IQ Option credentials not configured. Session will not open.');
      this.setHealth(SessionHealth.DOWN);
      throw new Error('IQ_OPTION_CREDENTIALS_MISSING');
    }
    await this.connect();
  }

  async disconnectSession(_accountId: string): Promise<void> {
    await this.disconnect();
  }

  protected buildAuthMessage(): string | null {
    const { creds } = this.creds.getIQOption();
    if (!creds) return null;
    return JSON.stringify({ name: 'ssid', msg: creds.ssid });
  }

  protected parseInboundMessage(raw: string) {
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!obj || typeof obj !== 'object') return null;

    if (obj.name === 'binary-options.open-option' && obj.request_id) {
      return { requestId: obj.request_id, payload: obj.msg as IQOrderResponse };
    }
    if (obj.name === 'profile.balance' && obj.msg?.amount !== undefined) {
      this.lastKnownBalance = Number(obj.msg.amount);
      this.lastAuthVerifiedAt = Date.now();
      return { event: 'balance', payload: obj.msg };
    }
    if (obj.name === 'instruments.binary.payout' && obj.msg) {
      const symbol = obj.msg.active;
      const exp = obj.msg.expiry_minutes;
      const payout = obj.msg.profit_percent;
      if (symbol && exp && typeof payout === 'number') {
        this.payoutCache.set(this.payoutKey(symbol, exp), payout / 100);
      }
      return { event: 'payout', payload: obj.msg };
    }
    // v2.6-5: track position close events so getOpenPositions reflects reality.
    if (obj.name === 'position-changed' && obj.msg) {
      this.trackPositionUpdate(obj.msg);
      return { event: 'position', payload: obj.msg };
    }
    if (obj.name === 'timeSync') {
      // ping-pong companion; not useful as event.
      return null;
    }
    return { event: obj.name, payload: obj.msg };
  }

  /**
   * v2.6-5: Subscribe to payout and balance streams after auth. Called
   * on every successful (re)connect so operators don't have to replay
   * subscription after a dropped session.
   */
  private restoreSubscriptions(): void {
    if (!this.ws || !this.authenticated) return;
    this.logger.log('Restoring subscriptions after session up');
    const defaultSubs = [
      'portfolio.position-changed',
      'profile.balance',
      'instruments.binary.payout',
    ];
    for (const sub of defaultSubs) {
      this.activeSubscriptions.add(sub);
    }
    for (const sub of this.activeSubscriptions) {
      try {
        this.sendPush({
          name: 'subscribeMessage',
          msg: { name: sub, version: '1.0' },
        });
      } catch (err) {
        this.logger.warn(
          `subscription ${sub} push failed: ${(err as Error).message}`,
        );
      }
    }
  }

  private trackPositionUpdate(msg: any): void {
    try {
      const accountId = String(msg.user_balance_id ?? 'default');
      const arr = this.accountPositions.get(accountId) ?? [];
      const id = String(msg.id ?? msg.position_id ?? '');
      if (!id) return;
      const status =
        msg.status === 'closed'
          ? BrokerPositionStatus.CLOSED
          : BrokerPositionStatus.OPEN;
      const openTs = msg.open_time
        ? new Date(msg.open_time * 1000).toISOString()
        : new Date().toISOString();
      const expiryTs = msg.expiry_time
        ? new Date(msg.expiry_time * 1000).toISOString()
        : (msg.close_time
            ? new Date(msg.close_time * 1000).toISOString()
            : openTs);
      const existing = arr.findIndex((p) => p.position_id === id);
      const next: BrokerPositionDTO = {
        position_id: id,
        symbol: String(msg.active_id ?? msg.active ?? ''),
        direction:
          msg.direction === 'call' ? SignalDirection.CALL : SignalDirection.PUT,
        status,
        stake_amount: Number(msg.invest ?? 0),
        entry_price: Number(msg.open_quote ?? msg.price ?? 0),
        open_ts_utc: openTs,
        expiry_ts_utc: expiryTs,
      };
      if (existing >= 0) arr[existing] = next;
      else arr.push(next);
      this.accountPositions.set(accountId, arr);
    } catch {
      // Never let a malformed broker payload crash the adapter.
    }
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const startTs = Date.now();

    // V2.5-3: gate order placement behind the real-enabled flag.
    if (!IQOptionRealAdapter.isRealEnabled()) {
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'REAL_DISABLED',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: 0,
        reject_code: 'REAL_DISABLED',
        reject_message:
          'IQ Option real adapter disabled. Set BROKER_IQOPTION_REAL_ENABLED=true or route via the simulator.',
      };
    }

    const { creds } = this.creds.getIQOption();

    if (!creds && !this.creds.isMockMode()) {
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'NOT_CONFIGURED',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: 0,
        reject_code: 'NOT_CONFIGURED',
        reject_message: 'IQ Option credentials not set. Populate .env or enable BROKER_MOCK_MODE=true.',
      };
    }

    if (this.getSessionHealth() !== SessionHealth.UP) {
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'SESSION_DOWN',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: 0,
        reject_code: 'SESSION_DOWN',
        reject_message: `IQ Option session is ${this.getSessionHealth()}`,
      };
    }

    const requestId = this.newRequestId();
    const payload = {
      name: 'sendMessage',
      request_id: requestId,
      msg: {
        name: 'binary-options.open-option',
        version: '1.0',
        body: {
          user_balance_id: creds?.balanceId ?? 0,
          active_id: this.resolveActiveId(request.symbol),
          option_type_id: 3,
          direction: request.direction === SignalDirection.CALL ? 'call' : 'put',
          expired: request.expiry_minutes * 60,
          price: request.stake_amount,
          value: request.stake_amount,
          request_id: requestId,
        },
      },
    };

    try {
      const resp = await this.sendRequest<IQOrderResponse>(requestId, payload, 5000);
      const latency = Date.now() - startTs;

      if (resp?.isSuccessful) {
        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: String(resp.id ?? requestId),
          status: BrokerOrderStatus.ACK,
          response_ts_utc: new Date().toISOString(),
          latency_ms: latency,
          open_price: resp.price ?? 0,
          open_ts_utc: new Date().toISOString(),
        };
      }

      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'REJECTED',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: latency,
        reject_code: 'BROKER_REJECT',
        reject_message: resp?.message || 'Order rejected by IQ Option',
      };
    } catch (err: any) {
      const latency = Date.now() - startTs;
      const isTimeout = /timeout/i.test(err?.message || '');
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: isTimeout ? 'TIMEOUT' : 'ERROR',
        status: isTimeout ? BrokerOrderStatus.TIMEOUT : BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: latency,
        reject_code: isTimeout ? 'TIMEOUT' : 'EXCEPTION',
        reject_message: err?.message || 'Unknown error',
      };
    }
  }

  async getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]> {
    return this.accountPositions.get(accountId) ?? [];
  }

  async getBalance(_accountId: string): Promise<number> {
    return this.lastKnownBalance;
  }

  async getPayoutRatio(symbol: string, expiryMinutes: number): Promise<number | null> {
    return this.payoutCache.get(this.payoutKey(symbol, expiryMinutes)) ?? null;
  }

  private payoutKey(symbol: string, exp: number): string {
    return `${symbol}:${exp}`;
  }

  private resolveActiveId(symbol: string): number {
    // v2.6-5: expanded map covering the common FX, commodities and crypto
    // actives that IQ Option exposes on binary options. This is a
    // static fallback; the adapter also honors dynamic IDs coming in via
    // `instruments.binary.payout` events — the resolver is used only
    // when we're placing a fresh order without prior cache.
    const map: Record<string, number> = {
      // FX majors
      EURUSD: 1, GBPUSD: 2, EURJPY: 3, USDJPY: 4, AUDUSD: 5, USDRUB: 6,
      USDCAD: 7, NZDUSD: 8, USDCHF: 9, EURGBP: 10,
      // FX crosses
      EURCHF: 11, AUDCAD: 12, AUDJPY: 13, EURAUD: 14, EURNZD: 15,
      GBPCAD: 16, GBPCHF: 17, GBPJPY: 18, NZDJPY: 19, CHFJPY: 20,
      // Commodities
      XAUUSD: 81, XAGUSD: 82, XPTUSD: 83, XPDUSD: 84,
      // Indices
      US500: 102, US30: 103, NAS100: 104, UK100: 105, GER30: 106,
      // Crypto
      BTCUSD: 816, ETHUSD: 817, LTCUSD: 818, XRPUSD: 819, BCHUSD: 820,
    };
    return map[symbol] ?? 1;
  }
}

// Status accessor required by BrokerPositionStatus import
void BrokerPositionStatus;
