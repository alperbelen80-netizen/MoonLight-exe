import { Injectable } from '@nestjs/common';
import { DomBrokerAdapterBase } from './dom-broker-base.adapter';
import {
  DomBrowserSessionManager,
  DomPageLike,
  SelectorRegistry,
  SelectorDriftGuard,
  VersionedSelectorBundle,
} from './dom-base';
import { BrokerHealthRegistryService } from '../../health/broker-health-registry.service';
import { BrokerOrderRequestDTO } from '../../../shared/dto/broker-order.dto';

/**
 * V2.6-5-B Olymp Trade DOM adapter.
 *
 * Uses the versioned selector bundle registered under 'OLYMP_TRADE'. See
 * `default-selectors.ts` for the shipped defaults — operators should keep
 * a newer bundle in their deployment so selector drift can be hot-patched
 * without a full release cycle.
 *
 * Live click is handled generically in the base class via `confirmButton`.
 * Per-broker login flow + quote read + stage order remain specialised.
 */
@Injectable()
export class OlympTradeDomAdapter extends DomBrokerAdapterBase {
  constructor(
    sessions: DomBrowserSessionManager,
    selectors: SelectorRegistry,
    health: BrokerHealthRegistryService,
    drift: SelectorDriftGuard,
  ) {
    super('OLYMP_TRADE', sessions, selectors, health);
    this.setDriftGuard(drift);
  }

  protected async performLogin(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
  ): Promise<void> {
    const email = process.env.OLYMP_TRADE_EMAIL || '';
    const password = process.env.OLYMP_TRADE_PASSWORD || '';
    if (!email || !password) {
      throw new Error('OLYMP_TRADE_CREDENTIALS_MISSING');
    }
    await page.waitForSelector(bundle.selectors.emailInput, { timeout: 15_000 });
    await page.fill(bundle.selectors.emailInput, email);
    await page.fill(bundle.selectors.passwordInput, password);
    await page.click(bundle.selectors.submitButton);
    await page.waitForSelector(bundle.selectors.dashboardReady, { timeout: 30_000 });
  }

  protected async readQuote(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    _symbol: string,
  ): Promise<number | null> {
    try {
      const txt = await page.textContent(bundle.selectors.lastPrice);
      if (!txt) return null;
      const n = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  protected async stageOrder(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    request: BrokerOrderRequestDTO,
  ): Promise<void> {
    await page.waitForSelector(bundle.selectors.stakeInput, { timeout: 5_000 });
    await page.fill(bundle.selectors.stakeInput, String(request.stake_amount));
    const dirSelector =
      this.directionKey(request.direction) === 'up'
        ? bundle.selectors.callButton
        : bundle.selectors.putButton;
    await page.waitForSelector(dirSelector, { timeout: 5_000 });
    // Dry-run stops here (does NOT click confirm). Live click is gated in
    // the base class by BROKER_DOM_LIVE_ORDERS=true.
  }
}

@Injectable()
export class BinomoDomAdapter extends DomBrokerAdapterBase {
  constructor(
    sessions: DomBrowserSessionManager,
    selectors: SelectorRegistry,
    health: BrokerHealthRegistryService,
    drift: SelectorDriftGuard,
  ) {
    super('BINOMO', sessions, selectors, health);
    this.setDriftGuard(drift);
  }

  protected async performLogin(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
  ): Promise<void> {
    const email = process.env.BINOMO_EMAIL || '';
    const password = process.env.BINOMO_PASSWORD || '';
    if (!email || !password) throw new Error('BINOMO_CREDENTIALS_MISSING');
    await page.waitForSelector(bundle.selectors.emailInput, { timeout: 15_000 });
    await page.fill(bundle.selectors.emailInput, email);
    await page.fill(bundle.selectors.passwordInput, password);
    await page.click(bundle.selectors.submitButton);
    await page.waitForSelector(bundle.selectors.dashboardReady, { timeout: 30_000 });
  }

  protected async readQuote(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    _symbol: string,
  ): Promise<number | null> {
    try {
      const txt = await page.textContent(bundle.selectors.lastPrice);
      if (!txt) return null;
      const n = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  protected async stageOrder(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    request: BrokerOrderRequestDTO,
  ): Promise<void> {
    await page.waitForSelector(bundle.selectors.stakeInput, { timeout: 5_000 });
    await page.fill(bundle.selectors.stakeInput, String(request.stake_amount));
    const dirSelector =
      this.directionKey(request.direction) === 'up'
        ? bundle.selectors.callButton
        : bundle.selectors.putButton;
    await page.waitForSelector(dirSelector, { timeout: 5_000 });
  }
}

@Injectable()
export class ExpertOptionDomAdapter extends DomBrokerAdapterBase {
  constructor(
    sessions: DomBrowserSessionManager,
    selectors: SelectorRegistry,
    health: BrokerHealthRegistryService,
    drift: SelectorDriftGuard,
  ) {
    super('EXPERT_OPTION', sessions, selectors, health);
    this.setDriftGuard(drift);
  }

  protected async performLogin(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
  ): Promise<void> {
    const email = process.env.EXPERT_OPTION_EMAIL || '';
    const password = process.env.EXPERT_OPTION_PASSWORD || '';
    if (!email || !password) throw new Error('EXPERT_OPTION_CREDENTIALS_MISSING');
    await page.waitForSelector(bundle.selectors.emailInput, { timeout: 15_000 });
    await page.fill(bundle.selectors.emailInput, email);
    await page.fill(bundle.selectors.passwordInput, password);
    await page.click(bundle.selectors.submitButton);
    await page.waitForSelector(bundle.selectors.dashboardReady, { timeout: 30_000 });
  }

  protected async readQuote(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    _symbol: string,
  ): Promise<number | null> {
    try {
      const txt = await page.textContent(bundle.selectors.lastPrice);
      if (!txt) return null;
      const n = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  protected async stageOrder(
    page: DomPageLike,
    bundle: VersionedSelectorBundle,
    request: BrokerOrderRequestDTO,
  ): Promise<void> {
    await page.waitForSelector(bundle.selectors.stakeInput, { timeout: 5_000 });
    await page.fill(bundle.selectors.stakeInput, String(request.stake_amount));
    const dirSelector =
      this.directionKey(request.direction) === 'up'
        ? bundle.selectors.callButton
        : bundle.selectors.putButton;
    await page.waitForSelector(dirSelector, { timeout: 5_000 });
  }
}
