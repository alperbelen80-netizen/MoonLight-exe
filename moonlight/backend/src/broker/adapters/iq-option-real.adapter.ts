import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO, BrokerOrderStatus } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO, BrokerPositionStatus } from '../../shared/dto/broker-position.dto';
import { WebSocket, RawData } from 'ws';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class IQOptionRealAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(IQOptionRealAdapter.name);
  private ws?: WebSocket;
  private authenticated = false;
  private ssid: string;
  private positions: Map<string, BrokerPositionDTO> = new Map();

  constructor() {
    this.ssid = process.env.IQ_OPTION_SSID || '';
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    if (!this.authenticated) {
      throw new Error('IQ Option not authenticated. Call connectSession() first.');
    }

    const startTime = Date.now();

    try {
      const requestId = uuidv4();

      const orderMessage = {
        name: 'sendMessage',
        msg: {
          name: 'binary-options.open-option',
          version: '1.0',
          body: {
            user_balance_id: parseInt(process.env.IQ_OPTION_BALANCE_ID || '1'),
            active_id: this.getActiveId(request.symbol),
            option_type_id: 3,
            direction: request.direction === 'CALL' ? 'call' : 'put',
            expired: request.expiry_minutes * 60,
            price: request.stake_amount,
            value: request.stake_amount,
            request_id: requestId,
          },
        },
      };

      const response = await this.sendWSMessage(orderMessage);

      const latency = Date.now() - startTime;

      if (response && response.isSuccessful) {
        const positionId = response.id || uuidv4();

        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: positionId.toString(),
          status: BrokerOrderStatus.ACK,
          response_ts_utc: new Date().toISOString(),
          latency_ms: latency,
          open_price: response.price || 0,
          open_ts_utc: new Date().toISOString(),
        };
      } else {
        return {
          broker_request_id: request.broker_request_id,
          broker_order_id: 'REJECTED',
          status: BrokerOrderStatus.REJECT,
          response_ts_utc: new Date().toISOString(),
          latency_ms: latency,
          reject_code: 'IQ_OPTION_ERROR',
          reject_message: response?.message || 'Order rejected',
        };
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;

      this.logger.error(`IQ Option order error: ${error.message}`);

      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: 'ERROR',
        status: BrokerOrderStatus.REJECT,
        response_ts_utc: new Date().toISOString(),
        latency_ms: latency,
        reject_code: 'EXCEPTION',
        reject_message: error.message,
      };
    }
  }

  async getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.positions.values()).filter(
      (p) => p.status === BrokerPositionStatus.OPEN,
    );
  }

  async getBalance(accountId: string): Promise<number> {
    if (!this.authenticated) {
      return 0;
    }

    return 10000;
  }

  async connectSession(accountId: string): Promise<void> {
    const wsUrl = process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket';

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.logger.log('IQ Option WebSocket connected');
        this.sendAuthMessage();

        setTimeout(() => {
          this.authenticated = true;
          resolve();
        }, 2000);
      });

      this.ws.on('message', (data: RawData) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        this.logger.error(`IQ Option WebSocket error: ${error.message}`);
        reject(error);
      });

      this.ws.on('close', () => {
        this.logger.warn('IQ Option WebSocket closed');
        this.authenticated = false;
      });
    });
  }

  async disconnectSession(accountId: string): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.authenticated = false;
    this.logger.log('IQ Option session disconnected');
  }

  private sendAuthMessage(): void {
    if (!this.ws || !this.ssid) return;

    const authMsg = {
      name: 'ssid',
      msg: this.ssid,
    };

    this.ws.send(JSON.stringify(authMsg));
    this.logger.log('IQ Option auth message sent');
  }

  private sendWSMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.ws.send(JSON.stringify(message));

      const timeout = setTimeout(() => {
        resolve({ isSuccessful: false, message: 'Timeout' });
      }, 5000);

      const messageHandler = (data: RawData) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.name === 'binary-options.open-option') {
            clearTimeout(timeout);
            this.ws?.removeListener('message', messageHandler);
            resolve(response.msg);
          }
        } catch (error) {
          // Ignore parse errors, wait for next message
        }
      };

      this.ws.on('message', messageHandler);
    });
  }

  private handleMessage(data: RawData): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.name === 'profile.balance') {
        this.logger.debug('Balance update received');
      }
    } catch (error) {
      // Silent fail for unknown messages
    }
  }

  private getActiveId(symbol: string): number {
    const mapping: Record<string, number> = {
      EURUSD: 1,
      GBPUSD: 2,
      USDJPY: 3,
      AUDUSD: 5,
      USDCAD: 7,
      XAUUSD: 81,
    };
    return mapping[symbol] || 1;
  }
}
