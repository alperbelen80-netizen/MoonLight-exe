import { LiveSignalEngine } from '../../../execution/live-signal-engine.service';

/**
 * V2.5-1 regression guard for the Live Signal Engine lazy-start contract.
 *
 * Before V2.5-1, the engine eagerly subscribed to a 4x3 (symbol x TF) grid
 * during onModuleInit(), which combined with MockLiveDataFeedAdapter's
 * synchronous 100-bar seed caused a startup CPU lock.
 *
 * V2.5-1 contract:
 *   - LIVE_SIGNAL_ENABLED != 'true'  → onModuleInit is a no-op.
 *   - LIVE_SIGNAL_AUTO_START != 'true' → engine is READY but not started.
 *   - start()/stop() are idempotent and update status snapshot correctly.
 *   - onModuleDestroy() stops cleanly.
 */
describe('LiveSignalEngine (V2.5-1 lazy-start)', () => {
  const originalEnv = { ...process.env };

  // Minimal fake adapter capturing subscribe/disconnect calls.
  function makeFakeAdapter() {
    const subs: Array<{ symbol: string; timeframe: string }> = [];
    let connected = false;
    return {
      subs,
      adapter: {
        async subscribeToCandles(s: string, tf: string): Promise<void> {
          subs.push({ symbol: s, timeframe: tf });
          connected = true;
        },
        async unsubscribeFromCandles(s: string, tf: string): Promise<void> {
          const idx = subs.findIndex((x) => x.symbol === s && x.timeframe === tf);
          if (idx >= 0) subs.splice(idx, 1);
        },
        isConnected(): boolean {
          return connected;
        },
        async disconnect(): Promise<void> {
          connected = false;
        },
        async listSupportedSymbols(): Promise<string[]> {
          return [];
        },
      },
      setConnected(v: boolean) {
        connected = v;
      },
    };
  }

  function makeEngine(env: Record<string, string>) {
    process.env = { ...originalEnv, ...env };
    const fake = makeFakeAdapter();
    const orchestrator = {
      getActiveAdapter: () => fake.adapter,
    } as unknown as ConstructorParameters<typeof LiveSignalEngine>[1];

    const noopRepo = {
      create: () => ({}),
      save: async () => ({}),
    } as unknown as ConstructorParameters<typeof LiveSignalEngine>[0];

    const engine = new LiveSignalEngine(
      noopRepo,
      orchestrator,
      {} as unknown as ConstructorParameters<typeof LiveSignalEngine>[2],
      {} as unknown as ConstructorParameters<typeof LiveSignalEngine>[3],
      {} as unknown as ConstructorParameters<typeof LiveSignalEngine>[4],
      {} as unknown as ConstructorParameters<typeof LiveSignalEngine>[5],
      {} as unknown as ConstructorParameters<typeof LiveSignalEngine>[6],
      { isEnabled: () => false } as unknown as ConstructorParameters<
        typeof LiveSignalEngine
      >[7],
    );
    return { engine, fake };
  }

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('onModuleInit is a no-op when LIVE_SIGNAL_ENABLED!=true', async () => {
    const { engine, fake } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'false',
      LIVE_SIGNAL_AUTO_START: 'true', // even auto-start is gated by enabled
      LIVE_SIGNAL_SYMBOLS: 'XAUUSD',
      LIVE_SIGNAL_TIMEFRAMES: '1m',
    });
    await engine.onModuleInit();
    expect(fake.subs.length).toBe(0);
    expect(engine.isRunning()).toBe(false);
    expect(engine.getStatus().enabled).toBe(false);
  });

  it('onModuleInit does NOT auto-start when LIVE_SIGNAL_AUTO_START!=true', async () => {
    const { engine, fake } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'true',
      LIVE_SIGNAL_AUTO_START: 'false',
      LIVE_SIGNAL_SYMBOLS: 'XAUUSD,EURUSD',
      LIVE_SIGNAL_TIMEFRAMES: '1m,5m',
    });
    await engine.onModuleInit();
    expect(fake.subs.length).toBe(0);
    expect(engine.isRunning()).toBe(false);

    const status = engine.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.running).toBe(false);
    expect(status.autoStart).toBe(false);
  });

  it('start() subscribes to every symbol x TF and is idempotent', async () => {
    const { engine, fake } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'true',
      LIVE_SIGNAL_AUTO_START: 'false',
      LIVE_SIGNAL_SYMBOLS: 'XAUUSD,EURUSD',
      LIVE_SIGNAL_TIMEFRAMES: '1m,5m,15m',
    });
    const status1 = await engine.start();
    expect(fake.subs.length).toBe(2 * 3);
    expect(engine.isRunning()).toBe(true);
    expect(status1.subscriptions).toHaveLength(6);
    expect(status1.running).toBe(true);

    // Second start() must be a no-op (idempotent).
    const status2 = await engine.start();
    expect(fake.subs.length).toBe(6);
    expect(status2.running).toBe(true);
  });

  it('stop() unsubscribes all subscriptions and disconnects the adapter', async () => {
    const { engine, fake } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'true',
      LIVE_SIGNAL_AUTO_START: 'false',
      LIVE_SIGNAL_SYMBOLS: 'XAUUSD',
      LIVE_SIGNAL_TIMEFRAMES: '1m,5m',
    });
    await engine.start();
    expect(fake.subs.length).toBe(2);

    const status = await engine.stop();
    expect(engine.isRunning()).toBe(false);
    expect(fake.subs.length).toBe(0);
    expect(status.running).toBe(false);
    expect(status.lastStoppedAtUtc).toBeTruthy();
  });

  it('start() is a no-op if engine is DISABLED', async () => {
    const { engine, fake } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'false',
      LIVE_SIGNAL_AUTO_START: 'false',
      LIVE_SIGNAL_SYMBOLS: 'XAUUSD',
      LIVE_SIGNAL_TIMEFRAMES: '1m',
    });
    const status = await engine.start();
    expect(fake.subs.length).toBe(0);
    expect(engine.isRunning()).toBe(false);
    expect(status.running).toBe(false);
  });

  it('onModuleDestroy() cleanly stops even if never started', async () => {
    const { engine } = makeEngine({
      LIVE_SIGNAL_ENABLED: 'true',
      LIVE_SIGNAL_AUTO_START: 'false',
    });
    await engine.onModuleDestroy(); // should not throw
    expect(engine.isRunning()).toBe(false);
  });
});
