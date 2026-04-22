import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import {
  BrokerOrderRequestDTO,
  BrokerOrderAckDTO,
  BrokerOrderStatus,
} from '../../shared/dto/broker-order.dto';
import {
  BrokerPositionDTO,
  BrokerPositionStatus,
} from '../../shared/dto/broker-position.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FakeBrokerAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(FakeBrokerAdapter.name);

  private shouldFail = false;
  private failCount = 0;
  private simulateRandomRejection = false;
  private openPositions: Map<string, BrokerPositionDTO> = new Map();
  private balances: Map<string, number> = new Map();
  private health: SessionHealth = SessionHealth.DOWN;
  private lastLatencyMs: number | null = null;

  getBrokerId(): string {
    return 'FAKE';
  }

  getSessionHealth(): SessionHealth {
    return this.health;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
    this.failCount = 0;
  }

  setFailOnce(): void {
    this.failCount = 1;
  }

  setSimulateRandomRejection(v: boolean): void {
    this.simulateRandomRejection = v;
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    this.logger.log(
      `[FakeBroker] Received order: ${request.symbol} ${request.direction} $${request.stake_amount}`,
    );

    if (this.shouldFail || this.failCount > 0) {
      if (this.failCount > 0) {
        this.failCount--;
      }
      throw new Error('FakeBroker simulated failure');
    }

    const latency = 40 + Math.random() * 80;
    await new Promise((resolve) => setTimeout(resolve, latency));
    this.lastLatencyMs = latency;

    const isAccept = this.simulateRandomRejection ? Math.random() > 0.1 : true;

    if (!isAccept) {
      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'REJECTED',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: latency,
        reject_code: 'MARKET_CLOSED',
        reject_message: 'Simulated rejection',
      };
    }

    const positionId = `FAKE_POS_${uuidv4()}`;
    const now = new Date();
    const expiry = new Date(now.getTime() + request.expiry_minutes * 60000);

    const position: BrokerPositionDTO = {
      position_id: positionId,
      symbol: request.symbol,
      direction: request.direction,
      stake_amount: request.stake_amount,
      entry_price: 2035.5 + Math.random() * 2,
      open_ts_utc: now.toISOString(),
      expiry_ts_utc: expiry.toISOString(),
      status: BrokerPositionStatus.OPEN,
    };

    this.openPositions.set(positionId, position);

    return {
      broker_request_id: request.broker_request_id,
      broker_order_id: positionId,
      status: BrokerOrderStatus.ACK,
      response_ts_utc: now.toISOString(),
      latency_ms: latency,
      open_price: position.entry_price,
      open_ts_utc: position.open_ts_utc,
    };
  }

  async getOpenPositions(_accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.openPositions.values());
  }

  async getBalance(accountId: string): Promise<number> {
    return this.balances.get(accountId) || 10000;
  }

  async connectSession(accountId: string): Promise<void> {
    this.logger.log(`[FakeBroker] Session connected for ${accountId}`);
    this.balances.set(accountId, 10000);
    this.health = SessionHealth.UP;
  }

  async disconnectSession(accountId: string): Promise<void> {
    this.logger.log(`[FakeBroker] Session disconnected for ${accountId}`);
    this.health = SessionHealth.DOWN;
  }

  clearPositions(): void {
    this.openPositions.clear();
  }
}
