import { Injectable } from '@nestjs/common';
import { BaseWSAdapter } from './base/base-ws.adapter';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { SignalDirection } from '../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';
import { BrokerCredentialsService } from './broker-credentials.service';

interface BinomoOrderResponse {
  request_id: string;
  deal_id?: string;
  success: boolean;
  open_price?: number;
  error_code?: string;
  error_message?: string;
}

/**
 * Binomo Protocol Adapter
 *
 * Uses Binomo's WebSocket protocol (reverse-engineered). Structure:
 *  - Auth: { action: 'auth', data: { token, device_id } }
 *  - Order: { action: 'deals/open', data: {...}, request_id }
 *  - Response: { action: 'deals/open/response', request_id, data }
 *
 * Credentials via BrokerCredentialsService.getBinomo().
 */
@Injectable()
export class BinomoProtocolAdapter extends BaseWSAdapter implements BrokerAdapterInterface {
  private lastKnownBalance = 0;
  private readonly accountPositions: Map<string, BrokerPositionDTO[]> = new Map();

  constructor(private readonly creds: BrokerCredentialsService) {
    const url = process.env.BINOMO_WS_URL || 'wss://ws.binomo.com/';
    super('BinomoProtocolAdapter', {
      url,
      heartbeatIntervalMs: 20000,
      requestTimeoutMs: 4000,
      maxReconnectAttempts: 5,
      reconnectBaseDelayMs: 1000,
    });
  }

  getBrokerId(): string {
    return 'BINOMO';
  }

  async connectSession(_accountId: string): Promise<void> {
    const { present } = this.creds.getBinomo();
    if (!present && !this.creds.isMockMode()) {
      this.logger.warn('Binomo credentials not configured. Session will not open.');
      this.setHealth(SessionHealth.DOWN);
      throw new Error('BINOMO_CREDENTIALS_MISSING');
    }
    await this.connect();
  }

  async disconnectSession(_accountId: string): Promise<void> {
    await this.disconnect();
  }

  protected buildAuthMessage(): string | null {
    const { creds } = this.creds.getBinomo();
    if (!creds) return null;
    return JSON.stringify({
      action: 'auth',
      data: { token: creds.authToken, device_id: creds.deviceId },
    });
  }

  protected parseInboundMessage(raw: string) {
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!obj || typeof obj !== 'object') return null;

    if (obj.action === 'deals/open/response' && obj.request_id) {
      const data = obj.data || {};
      return {
        requestId: obj.request_id,
        payload: {
          request_id: obj.request_id,
          deal_id: data.deal_id,
          success: data.status === 'success' || !!data.deal_id,
          open_price: data.open_price,
          error_code: data.error_code,
          error_message: data.error_message,
        } as BinomoOrderResponse,
      };
    }

    if (obj.action === 'balance/update' && obj.data?.amount !== undefined) {
      this.lastKnownBalance = Number(obj.data.amount);
      return { event: 'balance', payload: obj.data };
    }

    return { event: obj.action, payload: obj.data };
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const startTs = Date.now();
    const { present } = this.creds.getBinomo();

    if (!present && !this.creds.isMockMode()) {
      return this.rejectAck(request, 'NOT_CONFIGURED', 'Binomo credentials missing', startTs);
    }
    if (this.getSessionHealth() !== SessionHealth.UP) {
      return this.rejectAck(
        request,
        'SESSION_DOWN',
        `Binomo session is ${this.getSessionHealth()}`,
        startTs,
      );
    }

    const requestId = this.newRequestId();
    const payload = {
      action: 'deals/open',
      request_id: requestId,
      data: {
        asset: this.resolveAsset(request.symbol),
        created_at: Date.now(),
        ratio: request.expiry_minutes * 60,
        amount: request.stake_amount,
        trend: request.direction === SignalDirection.CALL ? 'call' : 'put',
      },
    };

    try {
      const resp = await this.sendRequest<BinomoOrderResponse>(requestId, payload, 4000);
      const latency = Date.now() - startTs;

      if (resp.success && resp.deal_id) {
        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: resp.deal_id,
          status: BrokerOrderStatus.ACK,
          response_ts_utc: new Date().toISOString(),
          latency_ms: latency,
          open_price: resp.open_price ?? 0,
          open_ts_utc: new Date().toISOString(),
        };
      }
      return this.rejectAck(
        request,
        resp.error_code || 'BROKER_REJECT',
        resp.error_message || 'Binomo rejected order',
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
      EURUSD: 'EUR/USD',
      GBPUSD: 'GBP/USD',
      USDJPY: 'USD/JPY',
      AUDUSD: 'AUD/USD',
      USDCAD: 'USD/CAD',
      XAUUSD: 'XAU/USD',
      BTCUSD: 'BTC/USD',
      ETHUSD: 'ETH/USD',
    };
    return map[symbol] ?? symbol;
  }
}
