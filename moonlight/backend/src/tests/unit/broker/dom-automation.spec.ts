import {
  DomBrowserSessionManager,
  SelectorRegistry,
  setPlaywrightImpl,
  DomPageLike,
  DomBrowserContextLike,
  DomBrowserLike,
  VersionedSelectorBundle,
} from '../../../broker/adapters/dom-automation/dom-base';
import {
  OlympTradeDomAdapter,
  BinomoDomAdapter,
  ExpertOptionDomAdapter,
} from '../../../broker/adapters/dom-automation/dom-broker.adapters';
import {
  DEFAULT_OLYMP_TRADE_SELECTORS,
  DEFAULT_BINOMO_SELECTORS,
  DEFAULT_EXPERT_OPTION_SELECTORS,
} from '../../../broker/adapters/dom-automation/default-selectors';
import { BrokerHealthRegistryService } from '../../../broker/health/broker-health-registry.service';
import {
  BrokerOrderRequestDTO,
  BrokerOrderStatus,
} from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../../shared/enums/session-health.enum';

// ---- Mock Playwright fixture ---------------------------------------------

interface MockCalls {
  gotos: string[];
  fills: Array<{ selector: string; value: string }>;
  clicks: string[];
  waited: string[];
  closed: boolean;
}

function makeMockPlaywright(
  overrides: Partial<{
    quoteText: string | null;
    waitShouldThrow: boolean;
  }> = {},
) {
  const calls: MockCalls = {
    gotos: [],
    fills: [],
    clicks: [],
    waited: [],
    closed: false,
  };

  const page: DomPageLike = {
    goto: async (url: string) => {
      calls.gotos.push(url);
    },
    fill: async (selector: string, value: string) => {
      calls.fills.push({ selector, value });
    },
    click: async (selector: string) => {
      calls.clicks.push(selector);
    },
    textContent: async (_selector: string) => overrides.quoteText ?? '1.0842',
    waitForSelector: async (selector: string) => {
      if (overrides.waitShouldThrow) throw new Error('selector not found');
      calls.waited.push(selector);
    },
    screenshot: async () => undefined,
    close: async () => {
      calls.closed = true;
    },
    evaluate: async () => undefined as unknown as never,
  };
  const context: DomBrowserContextLike = {
    newPage: async () => page,
    close: async () => undefined,
  };
  const browser: DomBrowserLike = {
    newContext: async () => context,
    close: async () => undefined,
  };
  const impl = {
    launch: async () => browser,
  };
  return { impl, calls, page };
}

function baseRequest(): BrokerOrderRequestDTO {
  return {
    broker_request_id: 'req_1',
    order_key: 'k1',
    symbol: 'EURUSD',
    direction: SignalDirection.CALL,
    stake_amount: 10,
    expiry_minutes: 1,
    art_id: 'ART_1',
    account_id: 'ACC_1',
    request_ts_utc: new Date().toISOString(),
  };
}

function fixture() {
  const sessions = new DomBrowserSessionManager({ headless: true });
  const selectors = new SelectorRegistry();
  selectors.register('OLYMP_TRADE', DEFAULT_OLYMP_TRADE_SELECTORS);
  selectors.register('BINOMO', DEFAULT_BINOMO_SELECTORS);
  selectors.register('EXPERT_OPTION', DEFAULT_EXPERT_OPTION_SELECTORS);
  const health = new BrokerHealthRegistryService();
  return { sessions, selectors, health };
}

describe('V2.5-4 DOM Broker Automation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    setPlaywrightImpl(null);
  });

  // ---- Feature-flag guard ------------------------------------------------

  it('automation flag off → connectSession throws DOM_AUTOMATION_DISABLED', async () => {
    delete process.env.BROKER_DOM_AUTOMATION_ENABLED;
    const f = fixture();
    const adapter = new OlympTradeDomAdapter(f.sessions, f.selectors, f.health);
    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      /DOM_AUTOMATION_DISABLED/,
    );
    expect(adapter.getSessionHealth()).toBe(SessionHealth.DOWN);
    expect(f.health.get('OLYMP_TRADE')?.state).toBe('DISABLED');
  });

  it('missing selector bundle → SELECTOR_BUNDLE_MISSING + DISABLED state', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    const sessions = new DomBrowserSessionManager();
    const selectors = new SelectorRegistry(); // empty
    const health = new BrokerHealthRegistryService();
    const adapter = new BinomoDomAdapter(sessions, selectors, health);
    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      /SELECTOR_BUNDLE_MISSING/,
    );
    expect(health.get('BINOMO')?.state).toBe('DISABLED');
  });

  it('missing credentials → errors on login + ERRORED state', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    delete process.env.OLYMP_TRADE_EMAIL;
    delete process.env.OLYMP_TRADE_PASSWORD;
    const { impl } = makeMockPlaywright();
    setPlaywrightImpl(impl);
    const f = fixture();
    const adapter = new OlympTradeDomAdapter(f.sessions, f.selectors, f.health);
    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      /OLYMP_TRADE_CREDENTIALS_MISSING/,
    );
    expect(f.health.get('OLYMP_TRADE')?.state).toBe('ERRORED');
  });

  // ---- Happy path: connect → ready → dry-run order ----------------------

  it('happy path: connect routes through CONNECTING → AUTHENTICATING → READY', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    process.env.OLYMP_TRADE_EMAIL = 'demo@olymp.test';
    process.env.OLYMP_TRADE_PASSWORD = 'pw';
    const { impl, calls } = makeMockPlaywright();
    setPlaywrightImpl(impl);
    const f = fixture();
    const adapter = new OlympTradeDomAdapter(f.sessions, f.selectors, f.health);

    await adapter.connectSession('ACC_1');

    expect(adapter.getSessionHealth()).toBe(SessionHealth.UP);
    expect(f.health.get('OLYMP_TRADE')?.state).toBe('READY');
    // Playwright login interactions should have been invoked.
    expect(calls.fills).toEqual([
      { selector: DEFAULT_OLYMP_TRADE_SELECTORS.selectors.emailInput, value: 'demo@olymp.test' },
      { selector: DEFAULT_OLYMP_TRADE_SELECTORS.selectors.passwordInput, value: 'pw' },
    ]);
    expect(calls.clicks).toContain(DEFAULT_OLYMP_TRADE_SELECTORS.selectors.submitButton);
    expect(calls.gotos).toContain(DEFAULT_OLYMP_TRADE_SELECTORS.loginUrl);

    await adapter.disconnectSession('ACC_1');
    expect(adapter.getSessionHealth()).toBe(SessionHealth.DOWN);
    expect(f.health.get('OLYMP_TRADE')?.state).toBe('DISCONNECTED');
  });

  it('dry-run sendOrder: ACK with DOM_DRYRUN_* id (no live click)', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    delete process.env.BROKER_DOM_LIVE_ORDERS;
    process.env.BINOMO_EMAIL = 'x@y';
    process.env.BINOMO_PASSWORD = 'pw';
    const { impl } = makeMockPlaywright({ quoteText: '1.0842' });
    setPlaywrightImpl(impl);
    const f = fixture();
    const adapter = new BinomoDomAdapter(f.sessions, f.selectors, f.health);
    await adapter.connectSession('ACC_1');
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.ACK);
    expect(ack.broker_order_id.startsWith('DOM_DRYRUN_BINOMO_')).toBe(true);
    expect(ack.open_price).toBe(1.0842);
    expect(ack.latency_ms).toBeGreaterThanOrEqual(0);

    const positions = await adapter.getOpenPositions('ACC_1');
    expect(positions).toHaveLength(1);
  });

  it('live flag on but no live impl → REJECT DOM_LIVE_UNSUPPORTED', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    process.env.BROKER_DOM_LIVE_ORDERS = 'true';
    process.env.EXPERT_OPTION_EMAIL = 'x@y';
    process.env.EXPERT_OPTION_PASSWORD = 'pw';
    const { impl } = makeMockPlaywright();
    setPlaywrightImpl(impl);
    const f = fixture();
    const adapter = new ExpertOptionDomAdapter(f.sessions, f.selectors, f.health);
    await adapter.connectSession('ACC_1');
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('DOM_LIVE_UNSUPPORTED');
  });

  // ---- Selector registry introspection ----------------------------------

  it('SelectorRegistry lists versions for all three brokers', () => {
    const f = fixture();
    const versions = f.selectors.listVersions();
    expect(versions).toHaveLength(3);
    expect(
      versions.find((v: { brokerId: string }) => v.brokerId === 'OLYMP_TRADE')
        ?.version,
    ).toBe(DEFAULT_OLYMP_TRADE_SELECTORS.version);
  });

  it('sendOrder when not connected → REJECT DOM_NOT_READY', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    const f = fixture();
    const adapter = new OlympTradeDomAdapter(f.sessions, f.selectors, f.health);
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('DOM_NOT_READY');
    expect(ack.latency_ms).toBe(0);
  });

  it('stageOrder selector drift → REJECT DOM_ERROR + ERRORED state', async () => {
    process.env.BROKER_DOM_AUTOMATION_ENABLED = 'true';
    process.env.OLYMP_TRADE_EMAIL = 'x@y';
    process.env.OLYMP_TRADE_PASSWORD = 'pw';

    // Build a mock where login works but the stakeInput selector throws.
    const calls: MockCalls = {
      gotos: [],
      fills: [],
      clicks: [],
      waited: [],
      closed: false,
    };
    const page: DomPageLike = {
      goto: async (url: string) => void calls.gotos.push(url),
      fill: async (s: string, v: string) => void calls.fills.push({ selector: s, value: v }),
      click: async (s: string) => void calls.clicks.push(s),
      textContent: async () => '1.08',
      waitForSelector: async (sel: string) => {
        // login selectors succeed; stakeInput deliberately fails
        if (sel === DEFAULT_OLYMP_TRADE_SELECTORS.selectors.stakeInput) {
          throw new Error('selector not found');
        }
        calls.waited.push(sel);
      },
      screenshot: async () => undefined,
      close: async () => void (calls.closed = true),
      evaluate: async () => undefined as unknown as never,
    };
    const context: DomBrowserContextLike = {
      newPage: async () => page,
      close: async () => undefined,
    };
    const browser: DomBrowserLike = {
      newContext: async () => context,
      close: async () => undefined,
    };
    setPlaywrightImpl({ launch: async () => browser });

    const f = fixture();
    const adapter = new OlympTradeDomAdapter(f.sessions, f.selectors, f.health);
    await adapter.connectSession('ACC_1');
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('DOM_ERROR');
    expect(f.health.get('OLYMP_TRADE')?.state).toBe('ERRORED');
  });
});

describe('V2.5-4 DOM runtime Playwright loader', () => {
  afterEach(() => setPlaywrightImpl(null));

  it('throws a clear error when playwright is not installed', async () => {
    const { getPlaywrightImpl } = await import(
      '../../../broker/adapters/dom-automation/dom-base'
    );
    // No injection; require('playwright') should fail in this env.
    setPlaywrightImpl(null);
    await expect(getPlaywrightImpl()).rejects.toThrow(
      /playwright is not installed/,
    );
  });

  it('prefers injected impl over real require()', async () => {
    const { getPlaywrightImpl } = await import(
      '../../../broker/adapters/dom-automation/dom-base'
    );
    const fake = { launch: jest.fn().mockResolvedValue({} as unknown) };
    setPlaywrightImpl(fake as unknown as never);
    const impl = await getPlaywrightImpl();
    expect(impl).toBe(fake);
  });
});
