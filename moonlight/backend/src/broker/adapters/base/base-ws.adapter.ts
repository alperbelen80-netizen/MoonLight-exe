import { Logger } from '@nestjs/common';
import { WebSocket, RawData } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { SessionHealth } from '../../../shared/enums/session-health.enum';

export interface WSPendingRequest {
  requestId: string;
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  sentAt: number;
}

export interface BaseWSAdapterOptions {
  url: string;
  heartbeatIntervalMs?: number;
  requestTimeoutMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
}

/**
 * BaseWSAdapter
 *
 * Abstract class that encapsulates all the cross-broker WebSocket lifecycle
 * concerns so concrete broker adapters (IQ Option, Binomo, Expert Option)
 * focus purely on protocol-specific payload shapes.
 *
 * Provides:
 *  - Connect / disconnect lifecycle with exponential backoff reconnect
 *  - Heartbeat ping/pong
 *  - Request/response correlation via pending map
 *  - SessionHealth transitions (UP | DEGRADED | RECONNECTING | COOLDOWN | DOWN)
 *  - Event emitter for downstream observers (health-change, raw-message, closed)
 *
 * All concrete adapters MUST implement:
 *  - parseInboundMessage(raw) => { requestId?; payload } | null
 *  - buildAuthMessage() => string
 */
export abstract class BaseWSAdapter extends EventEmitter {
  protected readonly logger: Logger;
  protected ws?: WebSocket;
  protected health: SessionHealth = SessionHealth.DOWN;
  protected authenticated = false;
  protected lastLatencyMs: number | null = null;

  private readonly pending: Map<string, WSPendingRequest> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private intentionallyClosed = false;

  constructor(
    loggerName: string,
    protected readonly opts: BaseWSAdapterOptions,
  ) {
    super();
    this.logger = new Logger(loggerName);
  }

  /** Concrete adapter defines auth payload to send after socket opens. */
  protected abstract buildAuthMessage(): string | null;

  /**
   * Concrete adapter parses a raw inbound message.
   * Returns { requestId } to resolve pending, or { event } for push events,
   * or null to ignore.
   */
  protected abstract parseInboundMessage(raw: string): {
    requestId?: string;
    event?: string;
    payload: any;
  } | null;

  protected wsOptions(): Record<string, any> {
    return {};
  }

  async connect(): Promise<void> {
    this.intentionallyClosed = false;
    this.setHealth(SessionHealth.RECONNECTING);

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      try {
        this.ws = new WebSocket(this.opts.url, this.wsOptions());
      } catch (err: any) {
        this.setHealth(SessionHealth.DOWN);
        return reject(err);
      }

      this.ws.on('open', () => {
        this.logger.log(`WS open: ${this.opts.url}`);
        this.reconnectAttempts = 0;

        const auth = this.buildAuthMessage();
        if (auth) {
          this.ws!.send(auth);
        }

        this.startHeartbeat();
        this.setHealth(SessionHealth.UP);
        this.authenticated = true;

        if (!settled) {
          settled = true;
          resolve();
        }
      });

      this.ws.on('message', (data: RawData) => this.handleRaw(data));

      this.ws.on('error', (err) => {
        this.logger.error(`WS error: ${err.message}`);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.logger.warn(
          `WS closed: code=${code} reason=${reason?.toString() || 'n/a'}`,
        );
        this.authenticated = false;
        this.stopHeartbeat();
        this.rejectAllPending(new Error('WS closed'));

        if (this.intentionallyClosed) {
          this.setHealth(SessionHealth.DOWN);
          return;
        }

        this.setHealth(SessionHealth.RECONNECTING);
        this.scheduleReconnect();
      });
    });
  }

  async disconnect(): Promise<void> {
    this.intentionallyClosed = true;
    this.stopHeartbeat();
    this.rejectAllPending(new Error('Adapter disconnected'));
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // swallow
      }
      this.ws = undefined;
    }
    this.setHealth(SessionHealth.DOWN);
  }

  /**
   * Send a request and await a correlated response.
   * The concrete adapter is responsible for shaping the outbound JSON and
   * ensuring that parseInboundMessage() returns a requestId that matches.
   */
  protected sendRequest<T = any>(
    requestId: string,
    payload: any,
    timeoutMs?: number,
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WS not connected'));
    }

    const ttl = timeoutMs ?? this.opts.requestTimeoutMs ?? 5000;
    const sentAt = Date.now();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`WS request timeout after ${ttl}ms (id=${requestId})`));
      }, ttl);

      this.pending.set(requestId, {
        requestId,
        resolve: resolve as any,
        reject,
        timer,
        sentAt,
      });

      try {
        this.ws!.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(err as Error);
      }
    });
  }

  /** Fire-and-forget outbound message. */
  protected sendPush(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }

  protected newRequestId(): string {
    return uuidv4();
  }

  getSessionHealth(): SessionHealth {
    return this.health;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  protected setHealth(next: SessionHealth): void {
    if (this.health !== next) {
      const prev = this.health;
      this.health = next;
      this.emit('health-change', { from: prev, to: next });
    }
  }

  private handleRaw(data: RawData): void {
    let text: string;
    try {
      text = data.toString();
    } catch {
      return;
    }

    let parsed;
    try {
      parsed = this.parseInboundMessage(text);
    } catch (err: any) {
      this.logger.warn(`parseInboundMessage failed: ${err?.message}`);
      return;
    }
    if (!parsed) return;

    const { requestId, event, payload } = parsed;

    if (requestId && this.pending.has(requestId)) {
      const p = this.pending.get(requestId)!;
      clearTimeout(p.timer);
      this.lastLatencyMs = Date.now() - p.sentAt;
      this.pending.delete(requestId);
      p.resolve(payload);
      return;
    }

    if (event) {
      this.emit('event', { event, payload });
    } else {
      this.emit('raw-message', payload);
    }
  }

  private startHeartbeat(): void {
    const interval = this.opts.heartbeatIntervalMs ?? 25000;
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        this.ws.ping();
      } catch {
        // swallow
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    const max = this.opts.maxReconnectAttempts ?? 6;
    const base = this.opts.reconnectBaseDelayMs ?? 1000;

    if (this.reconnectAttempts >= max) {
      this.logger.error(
        `Reconnect attempts exhausted (${max}). Moving to COOLDOWN.`,
      );
      this.setHealth(SessionHealth.COOLDOWN);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, base * Math.pow(2, this.reconnectAttempts - 1));
    this.logger.warn(
      `Reconnect attempt ${this.reconnectAttempts}/${max} in ${delay}ms`,
    );

    setTimeout(() => {
      if (this.intentionallyClosed) return;
      this.connect().catch((err) => {
        this.logger.error(`Reconnect failed: ${err?.message}`);
      });
    }, delay);
  }

  private rejectAllPending(err: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      try {
        p.reject(err);
      } catch {
        // swallow
      }
    }
    this.pending.clear();
  }
}
