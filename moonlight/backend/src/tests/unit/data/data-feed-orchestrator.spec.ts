import { DataFeedOrchestrator, ProviderHealth } from '../../../data/sources/data-feed-orchestrator.service';

describe('DataFeedOrchestrator', () => {
  let orchestrator: DataFeedOrchestrator;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.env.DATA_FEED_PROVIDER = 'MOCK_LIVE';
    orchestrator = new DataFeedOrchestrator();
    await orchestrator.onModuleInit();
  });

  afterEach(async () => {
    await orchestrator.onModuleDestroy();
  });

  it('initializes with MOCK_LIVE as active provider by default', () => {
    expect(orchestrator.getActiveProviderName()).toBe('MOCK_LIVE');
  });

  it('registers all 5 providers (MOCK, BINANCE, BYBIT, TRADINGVIEW, IQ_OPTION)', async () => {
    const all = await orchestrator.getAvailableProviders();
    const names = all.map((p) => p.name).sort();
    expect(names).toEqual(
      ['BINANCE_CCXT', 'BYBIT_CCXT', 'IQ_OPTION', 'MOCK_LIVE', 'TRADINGVIEW'].sort(),
    );
  });

  it('selectBestProvider: prefers the highest score', () => {
    const health: ProviderHealth[] = [
      { name: 'MOCK_LIVE', connected: true, latencyMs: 5, lastError: null, score: 10, kind: 'MOCK' },
      { name: 'BYBIT_CCXT', connected: true, latencyMs: 120, lastError: null, score: 97.6, kind: 'LIVE' },
      { name: 'BINANCE_CCXT', connected: false, latencyMs: 0, lastError: '451', score: -1, kind: 'LIVE' },
      { name: 'TRADINGVIEW', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'WEBHOOK' },
      { name: 'IQ_OPTION', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'LIVE' },
    ];
    expect(orchestrator.selectBestProvider(health)).toBe('BYBIT_CCXT');
  });

  it('selectBestProvider: falls back to MOCK_LIVE when all live providers are DOWN', () => {
    const health: ProviderHealth[] = [
      { name: 'MOCK_LIVE', connected: true, latencyMs: 5, lastError: null, score: 10, kind: 'MOCK' },
      { name: 'BYBIT_CCXT', connected: false, latencyMs: 0, lastError: '403', score: -1, kind: 'LIVE' },
      { name: 'BINANCE_CCXT', connected: false, latencyMs: 0, lastError: '451', score: -1, kind: 'LIVE' },
      { name: 'TRADINGVIEW', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'WEBHOOK' },
      { name: 'IQ_OPTION', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'LIVE' },
    ];
    expect(orchestrator.selectBestProvider(health)).toBe('MOCK_LIVE');
  });

  it('selectBestProvider: BYBIT beats BINANCE on equal scores via tie-breaker', () => {
    const health: ProviderHealth[] = [
      { name: 'MOCK_LIVE', connected: true, latencyMs: 5, lastError: null, score: 10, kind: 'MOCK' },
      { name: 'BYBIT_CCXT', connected: true, latencyMs: 100, lastError: null, score: 50, kind: 'LIVE' },
      { name: 'BINANCE_CCXT', connected: true, latencyMs: 100, lastError: null, score: 50, kind: 'LIVE' },
      { name: 'TRADINGVIEW', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'WEBHOOK' },
      { name: 'IQ_OPTION', connected: false, latencyMs: null, lastError: null, score: -1, kind: 'LIVE' },
    ];
    expect(orchestrator.selectBestProvider(health)).toBe('BYBIT_CCXT');
  });

  it('switchProvider: changes active provider', async () => {
    await orchestrator.switchProvider('BYBIT_CCXT');
    expect(orchestrator.getActiveProviderName()).toBe('BYBIT_CCXT');
  });

  it('switchProvider: rejects unknown provider', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(orchestrator.switchProvider('FOO_BAR' as any)).rejects.toThrow('Unknown provider');
  });

  it(
    'getProvidersHealth: returns a status object for every registered provider',
    async () => {
      const health = await orchestrator.getProvidersHealth();
      expect(health).toHaveLength(5);
      const mockEntry = health.find((h) => h.name === 'MOCK_LIVE');
      expect(mockEntry?.connected).toBe(true);
      expect(mockEntry?.score).toBe(10);
      expect(mockEntry?.kind).toBe('MOCK');
    },
    30_000,
  );

  it(
    'probeAndScore: returns active, deterministicChoice and health array',
    async () => {
      const result = await orchestrator.probeAndScore();
      expect(result.active).toBe('MOCK_LIVE');
      expect(result.health).toHaveLength(5);
      expect(result.deterministicChoice).toBeDefined();
    },
    30_000,
  );
});
