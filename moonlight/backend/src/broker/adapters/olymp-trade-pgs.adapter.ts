import { Injectable, Logger } from '@nestjs/common';
import { BrokerAdapterInterface } from './broker-adapter.interface';
import {
  BrokerOrderRequestDTO,
  BrokerOrderAckDTO,
  BrokerOrderStatus,
} from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { SignalDirection } from '../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';
import { BrokerCredentialsService } from './broker-credentials.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Olymp Trade PGS Adapter
 *
 * Olymp Trade does not publish an official trading API. This adapter uses a
 * CDP-based approach (Playwright-powered headful/headless Chromium) to drive
 * the web UI and place/read trades through the production DOM.
 *
 * This adapter is INTENTIONALLY LAZY about importing Playwright:
 *  - If the `playwright` package is present AND creds are configured, it will
 *    start a persistent browser session on connectSession().
 *  - If Playwright is absent, the adapter throws a clear, actionable error
 *    message on connectSession() instead of at import-time — so the rest of
 *    the backend boots and tests run without Playwright installed.
 *
 * Install (only when needed):
 *   yarn add playwright
 *   npx playwright install chromium
 *
 * Credentials via BrokerCredentialsService.getOlympTrade().
 */
@Injectable()
export class OlympTradePGSAdapter implements BrokerAdapterInterface {
  private readonly logger = new Logger(OlympTradePGSAdapter.name);

  private browser: any | null = null;
  private context: any | null = null;
  private page: any | null = null;
  private health: SessionHealth = SessionHealth.DOWN;
  private lastLatencyMs: number | null = null;
  private lastKnownBalance = 0;
  private readonly openPositions: Map<string, BrokerPositionDTO> = new Map();

  constructor(private readonly creds: BrokerCredentialsService) {}

  getBrokerId(): string {
    return 'OLYMP_TRADE';
  }

  getSessionHealth(): SessionHealth {
    return this.health;
  }

  getLastLatencyMs(): number | null {
    return this.lastLatencyMs;
  }

  async connectSession(_accountId: string): Promise<void> {
    const { present, creds } = this.creds.getOlympTrade();
    if (!present && !this.creds.isMockMode()) {
      this.health = SessionHealth.DOWN;
      throw new Error('OLYMP_TRADE_CREDENTIALS_MISSING');
    }

    let playwright: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      playwright = require('playwright');
    } catch {
      this.health = SessionHealth.DOWN;
      throw new Error(
        'PLAYWRIGHT_NOT_INSTALLED: Install with `yarn add playwright && npx playwright install chromium` to enable Olymp Trade live trading.',
      );
    }

    try {
      this.health = SessionHealth.RECONNECTING;
      this.browser = await playwright.chromium.launch({ headless: creds?.headless ?? true });
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();

      if (creds) {
        await this.page.goto(creds.loginUrl, { waitUntil: 'networkidle' });
        // Selector names below are placeholders; in production these must be
        // kept in sync with Olymp Trade’s actual DOM. They are centralized here
        // for quick maintenance.
        await this.page.fill('input[name="email"]', creds.email);
        await this.page.fill('input[name="password"]', creds.password);
        await this.page.click('button[type="submit"]');
        await this.page.waitForURL(/platform|trade/, { timeout: 15000 });
      }

      this.health = SessionHealth.UP;
      this.logger.log('Olymp Trade session established (CDP).');
    } catch (err: any) {
      this.health = SessionHealth.DOWN;
      this.logger.error(`Olymp Trade session failed: ${err?.message}`);
      await this.cleanup();
      throw err;
    }
  }

  async disconnectSession(_accountId: string): Promise<void> {
    await this.cleanup();
    this.health = SessionHealth.DOWN;
  }

  async sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO> {
    const startTs = Date.now();
    const { present } = this.creds.getOlympTrade();

    if (!present && !this.creds.isMockMode()) {
      return this.rejectAck(request, 'NOT_CONFIGURED', 'Olymp Trade credentials missing', startTs);
    }
    if (this.health !== SessionHealth.UP) {
      return this.rejectAck(
        request,
        'SESSION_DOWN',
        `Olymp Trade session is ${this.health}`,
        startTs,
      );
    }
    if (!this.page) {
      return this.rejectAck(request, 'PAGE_UNAVAILABLE', 'Browser page is not ready', startTs);
    }

    // Real CDP flow would manipulate the trade panel here. We provide a well
    // structured skeleton that can be completed once real DOM selectors are
    // authored. Each step is defensively wrapped to fail-closed.
    try {
      await this.page.click('[data-test="asset-selector"]', { timeout: 5000 });
      await this.page.fill('[data-test="amount-input"]', String(request.stake_amount));
      await this.page.fill(
        '[data-test="duration-input"]',
        String(request.expiry_minutes),
      );
      const buttonSelector =
        request.direction === SignalDirection.CALL
          ? '[data-test="buy-higher"]'
          : '[data-test="buy-lower"]';
      await this.page.click(buttonSelector, { timeout: 5000 });

      // We optimistically assume the click succeeded; in production we would
      // wait for a visible confirmation element and scrape the deal id.
      const latency = Date.now() - startTs;
      this.lastLatencyMs = latency;
      const positionId = `OLYMP_${uuidv4()}`;

      const position: BrokerPositionDTO = {
        position_id: positionId,
        symbol: request.symbol,
        direction: request.direction,
        stake_amount: request.stake_amount,
        entry_price: 0,
        open_ts_utc: new Date().toISOString(),
        expiry_ts_utc: new Date(Date.now() + request.expiry_minutes * 60_000).toISOString(),
        status: 'OPEN' as any,
      };
      this.openPositions.set(positionId, position);

      return {
        broker_request_id: request.broker_request_id,
        broker_order_id: positionId,
        status: BrokerOrderStatus.ACK,
        response_ts_utc: new Date().toISOString(),
        latency_ms: latency,
        open_ts_utc: position.open_ts_utc,
      };
    } catch (err: any) {
      return this.rejectAck(
        request,
        'CDP_FAILURE',
        err?.message || 'Olymp Trade DOM interaction failed',
        startTs,
      );
    }
  }

  async getOpenPositions(_accountId: string): Promise<BrokerPositionDTO[]> {
    return Array.from(this.openPositions.values());
  }

  async getBalance(_accountId: string): Promise<number> {
    return this.lastKnownBalance;
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) await this.page.close();
    } catch {
      // swallow
    }
    try {
      if (this.context) await this.context.close();
    } catch {
      // swallow
    }
    try {
      if (this.browser) await this.browser.close();
    } catch {
      // swallow
    }
    this.page = null;
    this.context = null;
    this.browser = null;
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
}
