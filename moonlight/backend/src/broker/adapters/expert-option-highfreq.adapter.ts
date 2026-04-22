import { Injectable } from '@nestjs/common';
import { BaseWSAdapter } from './base/base-ws.adapter';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { SignalDirection } from '../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';
import { BrokerCredentialsService } from './broker-credentials.service';

interface EOOrderResponse {
  reqId: string;
  ok: boolean;
  position_id?: string;
  open_price?: number;
  reject_reason?: string;
}

/**
 * Expert Option High-Frequency Adapter
 *
 * Targets Expert Option's WSS endpoint with a tight request/response loop tuned
 * for high-frequency tick streaming. Protocol (reverse-engineered):
 *  - Auth: { action: 'authorization', token }
 *  - Order: { action: 'openOption', reqId, body: {...} }
 *  - Response: { action: 'openOption.result', reqId, body }
 *
 * Credentials via BrokerCredentialsService.getExpertOption().
 */
@Injectable()
export class ExpertOptionHighFreqAdapter
  extends BaseWSAdapter
  implements BrokerAdapterInterface
{
  private lastKnownBalance = 0;
  private readonly accountPositions: Map<string, BrokerPositionDTO[]> = new Map();

  constructor(private readonly creds: BrokerCredentialsService) {
    const url = process.env.EXPERT_OPTION_WS_URL || 'wss://fr24g1us0.expertoption.com/';
    super('ExpertOptionHighFreqAdapter', {
      url,
      heartbeatIntervalMs: 15000,
      requestTimeoutMs: 3000,
      maxReconnectAttempts: 6,
      reconnectBaseDelayMs: 750,
    });
  }

  getBrokerId(): string {
    return 'EXPERT_OPTION';
  }

  async connectSession(_accountId: string): Promise<void> {
    const { present } = this.creds.getExpertOption();
    if (!present && !this.creds.isMockMode()) {
      this.logger.warn('Expert Option credentials not configured.');
      this.setHealth(SessionHealth.DOWN);
      throw new Error('EXPERT_OPTION_CREDENTIALS_MISSING');
    }
    await this.connect();
  }

  async disconnectSession(_accountId: string): Promise<void> {
    await this.disconnect();
  }

  protected buildAuthMessage(): string | null {
    const { creds } = this.creds.getExpertOption();
    if (!creds) return null;
    return JSON.stringify({ action: 'authorization', token: creds.token });
  }

  protected parseInboundMessage(raw: string) {
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!obj || typeof obj !== 'object') return null;

    if (obj.action === 'openOption.result' && obj.reqId) {
      const body = obj.body || {};
      return {
        requestId: obj.reqId,
        payload: {
          reqId: obj.reqId,
          ok: body.success === true || !!body.position_id,
          position_id: body.position_id,
          open_price: body.open_price,
          reject_reason: body.reject_reason,
        } as EOOrderResponse,
      };
    }

    if (obj.action === 'balance' && obj.body?.amount !== undefined) {
      this.lastKnownBalance = Number(obj.body.amount);
      return { event: 'balance', payload: obj.body };
    }

    return { event: obj.action, payload: obj.body };
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const startTs = Date.now();
    const { present } = this.creds.getExpertOption();

    if (!present && !this.creds.isMockMode()) {
      return this.rejectAck(request, 'NOT_CONFIGURED', 'Expert Option token missing', startTs);
    }
    if (this.getSessionHealth() !== SessionHealth.UP) {
      return this.rejectAck(
        request,
        'SESSION_DOWN',
        `Expert Option session is ${this.getSessionHealth()}`,
        startTs,
      );
    }

    const reqId = this.newRequestId();
    const payload = {
      action: 'openOption',
      reqId,
      body: {
        asset: this.resolveAsset(request.symbol),
        type: request.direction === SignalDirection.CALL ? 'call' : 'put',
        amount: request.stake_amount,
        expiration: request.expiry_minutes * 60,
        strike_time: Math.floor(Date.now() / 1000),
      },
    };

    try {
      const resp = await this.sendRequest<EOOrderResponse>(reqId, payload, 3000);
      const latency = Date.now() - startTs;

      if (resp.ok && resp.position_id) {
        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: resp.position_id,
          status: BrokerOrderStatus.ACK,
          response_ts_utc: new Date().toISOString(),
          latency_ms: latency,
          open_price: resp.open_price ?? 0,
          open_ts_utc: new Date().toISOString(),
        };
      }
      return this.rejectAck(
        request,
        'BROKER_REJECT',
        resp.reject_reason || 'Expert Option rejected order',
        startTs,
      );
    } catch (err: any) {
      const isTimeout = /timeout/i.test(err?.message || '');
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: isTimeout ? 'TIMEOUT' : 'ERROR',
        status: isTimeout ? BrokerOrderStatus.TIMEOUT : BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: Date.now() - startTs,
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

  private rejectAck(
    request: BrokerOrderRequestDTO,
    code: string,
    message: string,
    startTs: number,
  ): BrokerOrderAckDTO {
    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: code,
      status: BrokerOrderStatus.REJECT,
      response_ts_utc: new Date().toISOString(),
      latency_ms: Date.now() - startTs,
      reject_code: code,
      reject_message: message,
    };
  }

  private resolveAsset(symbol: string): string {
    const map: Record<string, string> = {
      EURUSD: 'EURUSD',
      GBPUSD: 'GBPUSD',
      USDJPY: 'USDJPY',
      AUDUSD: 'AUDUSD',
      USDCAD: 'USDCAD',
      XAUUSD: 'XAUUSD',
      BTCUSD: 'BTCUSD',
      ETHUSD: 'ETHUSD',
    };
    return map[symbol] ?? symbol;
  }
}
