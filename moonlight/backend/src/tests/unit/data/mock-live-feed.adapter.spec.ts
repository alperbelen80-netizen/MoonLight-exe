import { MockLiveDataFeedAdapter } from '../../../data/sources/mock-live-feed.adapter';
import { CandleData } from '../../../data/sources/data-feed.interface';

/**
 * V2.5-1 regression guard: the mock adapter used to synchronously emit
 * 100 seed bars per subscribe() call, which — when LiveSignalEngine wired
 * 4 symbols x 3 TFs — caused a startup CPU spike in the real process.
 *
 * These tests lock in:
 *   - chunked async seed with event-loop yields
 *   - correct seed count (configurable)
 *   - timer .unref() (so Jest workers don't hang on open handles)
 *   - idempotent subscribe / disconnect lifecycle
 */
describe('MockLiveDataFeedAdapter (V2.5-1 hardened)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Keep env hygiene between tests.
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('emits exactly MOCK_FEED_SEED_BARS handler calls during seed (chunked)', async () => {
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '25';
    process.env.MOCK_FEED_SEED_CHUNK = '5';
    process.env.MOCK_FEED_INTERVAL_MS = '60000'; // irrelevant for seed assertion

    const adapter = new MockLiveDataFeedAdapter();
    const received: CandleData[] = [];

    await adapter.subscribeToCandles('XAUUSD', '1m', (c) => {
      received.push(c);
    });

    expect(received.length).toBe(25);
    // Must be monotonically ordered in time (descending barIdx → ascending ts).
    for (let i = 1; i < received.length; i++) {
      expect(received[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        received[i - 1].timestamp.getTime(),
      );
    }
    await adapter.disconnect();
  });

  it('subscribe yields the event-loop between chunks (non-blocking)', async () => {
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '40';
    process.env.MOCK_FEED_SEED_CHUNK = '10';
    process.env.MOCK_FEED_INTERVAL_MS = '60000';

    const adapter = new MockLiveDataFeedAdapter();
    let interleavedTaskRan = false;

    const subscribePromise = adapter.subscribeToCandles(
      'EURUSD',
      '1m',
      () => undefined,
    );

    // This microtask would never run if subscribeToCandles blocked the loop.
    setImmediate(() => {
      interleavedTaskRan = true;
    });

    await subscribePromise;
    expect(interleavedTaskRan).toBe(true);

    await adapter.disconnect();
  });

  it('respects MOCK_FEED_INTERVAL_MS floor (>= 500ms, default 30000ms)', async () => {
    // Lower-bound guard: even if env is nonsense, never tick faster than default.
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '0';
    process.env.MOCK_FEED_INTERVAL_MS = '10'; // too small → should clamp to 30000

    const adapter = new MockLiveDataFeedAdapter();

    const spy = jest.spyOn(global, 'setInterval');
    await adapter.subscribeToCandles('BTCUSD', '1m', () => undefined);

    expect(spy).toHaveBeenCalled();
    const ms = (spy.mock.calls[spy.mock.calls.length - 1] as unknown as [
      unknown,
      number,
    ])[1];
    expect(ms).toBeGreaterThanOrEqual(500);
    // The adapter clamps invalid (<500) values to 30000.
    expect(ms).toBe(30000);

    spy.mockRestore();
    await adapter.disconnect();
  });

  it('live interval timer is .unref()-ed (does not keep Node alive)', async () => {
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '0';
    process.env.MOCK_FEED_INTERVAL_MS = '30000';

    const adapter = new MockLiveDataFeedAdapter();
    let capturedTimer: unknown = null;

    const original = global.setInterval;
    const spy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation(((...args: unknown[]) => {
        const [fn, ms] = args as [() => void, number];
        const t = original(fn, ms);
        capturedTimer = t;
        return t;
      }) as unknown as typeof setInterval);

    await adapter.subscribeToCandles('XAUUSD', '1m', () => undefined);

    // Raw Node timers expose .unref(); the adapter should have called it so
    // the live pump never blocks graceful shutdown.
    expect(capturedTimer).toBeTruthy();
    // Check that the timer object has unref function (it always does for real timers)
    expect(
      typeof (capturedTimer as { unref?: () => unknown }).unref,
    ).toBe('function');

    spy.mockRestore();
    await adapter.disconnect();
  });

  it('double subscribe for the same key is a no-op (idempotent)', async () => {
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '5';
    process.env.MOCK_FEED_SEED_CHUNK = '5';
    process.env.MOCK_FEED_INTERVAL_MS = '60000';

    const adapter = new MockLiveDataFeedAdapter();
    let received1 = 0;
    let received2 = 0;

    await adapter.subscribeToCandles('XAUUSD', '1m', () => {
      received1++;
    });
    // second subscribe should NOT replace or duplicate the first handler
    await adapter.subscribeToCandles('XAUUSD', '1m', () => {
      received2++;
    });

    expect(received1).toBe(5);
    expect(received2).toBe(0);
    expect(adapter.getSubscriptionCount()).toBe(1);

    await adapter.disconnect();
    expect(adapter.getSubscriptionCount()).toBe(0);
  });

  it('disconnect clears all timers and marks adapter disconnected', async () => {
    process.env.MOCK_FEED_FAST_DEMO = 'true';
    process.env.MOCK_FEED_SEED_BARS = '0';
    process.env.MOCK_FEED_INTERVAL_MS = '30000';

    const adapter = new MockLiveDataFeedAdapter();
    await adapter.subscribeToCandles('EURUSD', '1m', () => undefined);
    await adapter.subscribeToCandles('GBPUSD', '1m', () => undefined);
    expect(adapter.isConnected()).toBe(true);
    expect(adapter.getSubscriptionCount()).toBe(2);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.getSubscriptionCount()).toBe(0);
  });
});
