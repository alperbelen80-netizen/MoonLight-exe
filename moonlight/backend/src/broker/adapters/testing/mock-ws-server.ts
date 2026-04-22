import { WebSocketServer, WebSocket, RawData } from 'ws';
import { AddressInfo } from 'net';

export interface MockHandler {
  /**
   * Called for every inbound message. Return:
   *  - string: the exact text to send back
   *  - object: will be JSON.stringified and sent back
   *  - null / undefined: no response
   */
  (raw: string, client: WebSocket): string | object | null | void | Promise<string | object | null | void>;
}

/**
 * MockWSServer
 *
 * Lightweight in-process WebSocket server for unit-testing broker adapters
 * without hitting real brokers. Provides:
 *  - Auto-assigned port (use getUrl() to retrieve the ws:// URL)
 *  - Pluggable MockHandler that can replay canned responses
 *  - Failure injection utilities: dropNextN, closeOnMessage, delayMs
 */
export class MockWSServer {
  private server?: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private handler: MockHandler = () => null;
  private dropNext = 0;
  private closeOnNextMessage = false;
  private artificialDelayMs = 0;

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: 0 });
      this.server.on('listening', () => {
        const addr = this.server!.address() as AddressInfo;
        resolve(addr.port);
      });
      this.server.on('error', reject);

      this.server.on('connection', (ws) => {
        this.clients.add(ws);
        ws.on('message', async (data: RawData) => {
          if (this.closeOnNextMessage) {
            this.closeOnNextMessage = false;
            ws.close();
            return;
          }
          if (this.dropNext > 0) {
            this.dropNext--;
            return;
          }
          if (this.artificialDelayMs > 0) {
            await new Promise((r) => setTimeout(r, this.artificialDelayMs));
          }

          const raw = data.toString();
          const resp = await Promise.resolve(this.handler(raw, ws));
          if (resp === null || resp === undefined) return;

          const text = typeof resp === 'string' ? resp : JSON.stringify(resp);
          try {
            ws.send(text);
          } catch {
            // swallow
          }
        });
        ws.on('close', () => this.clients.delete(ws));
      });
    });
  }

  setHandler(fn: MockHandler): void {
    this.handler = fn;
  }

  dropNextMessages(n: number): void {
    this.dropNext = n;
  }

  closeClientOnNextMessage(): void {
    this.closeOnNextMessage = true;
  }

  setArtificialDelay(ms: number): void {
    this.artificialDelayMs = ms;
  }

  async broadcast(payload: object | string): Promise<void> {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const c of this.clients) {
      if (c.readyState === WebSocket.OPEN) {
        try {
          c.send(text);
        } catch {
          // swallow
        }
      }
    }
  }

  getUrl(): string {
    const addr = this.server?.address() as AddressInfo;
    return `ws://127.0.0.1:${addr.port}`;
  }

  async stop(): Promise<void> {
    for (const c of this.clients) {
      try {
        c.close();
      } catch {
        // swallow
      }
    }
    this.clients.clear();
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
  }
}
