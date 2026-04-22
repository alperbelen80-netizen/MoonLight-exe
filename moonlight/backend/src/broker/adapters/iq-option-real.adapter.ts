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

  constructor(private readonly creds: BrokerCredentialsService) {
    const url = process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket';
    super('IQOptionRealAdapter', {
      url,
      heartbeatIntervalMs: 25000,
      requestTimeoutMs: 5000,
      maxReconnectAttempts: 6,
      reconnectBaseDelayMs: 1000,
    });
  }

  getBrokerId(): string {
    return 'IQ_OPTION';
  }

  async connectSession(_accountId: string): Promise<void> {
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
    return { event: obj.name, payload: obj.msg };
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const startTs = Date.now();
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
    const map: Record<string, number> = {
      EURUSD: 1,
      GBPUSD: 2,
      USDJPY: 3,
      AUDUSD: 5,
      USDCAD: 7,
      XAUUSD: 81,
      BTCUSD: 816,
      ETHUSD: 817,
    };
    return map[symbol] ?? 1;
  }
}

// Status accessor required by BrokerPositionStatus import
void BrokerPositionStatus;
