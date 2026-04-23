import { AIInsightsService } from '../../../ai-coach/ai-insights.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';

describe('AIInsightsService', () => {
  const baseRows = [
    {
      id: '1',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      direction: 'CALL',
      strategy_family: 'rsi_trend',
      confidence_score: 0.7,
      ai_verdict: 'APPROVED',
      timestamp_utc: new Date(),
      notes: 'Regime: TREND (ADX: 27.3)',
    },
    {
      id: '2',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      direction: 'PUT',
      strategy_family: 'rsi_trend',
      confidence_score: 0.6,
      ai_verdict: 'REJECTED',
      timestamp_utc: new Date(),
      notes: 'Regime: RANGE (ADX: 16.0)',
    },
    {
      id: '3',
      symbol: 'ETHUSDT',
      timeframe: '1m',
      direction: 'CALL',
      strategy_family: 'macd_cross',
      confidence_score: 0.8,
      ai_verdict: 'APPROVED',
      timestamp_utc: new Date(),
      notes: 'Regime: TREND (ADX: 31.0)',
    },
  ];

  const liveRepo: any = { find: jest.fn().mockResolvedValue(baseRows) };
  const perfRepo: any = { find: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    liveRepo.find.mockClear();
    liveRepo.find.mockResolvedValue(baseRows);
    delete process.env.EMERGENT_LLM_KEY;
  });

  it('getDailyInsights computes totals and approval rate', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const insights = await svc.getDailyInsights(24, true);
    expect(insights.totals.signals).toBe(3);
    expect(insights.totals.approved).toBe(2);
    expect(insights.totals.rejected).toBe(1);
    expect(insights.totals.approval_rate).toBeCloseTo(2 / 3, 2);
  });

  it('getDailyInsights ranks top_symbols correctly', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const insights = await svc.getDailyInsights(24, true);
    expect(insights.top_symbols[0].symbol).toBe('BTCUSDT');
    expect(insights.top_symbols[0].count).toBe(2);
  });

  it('getDailyInsights extracts regime_distribution from notes', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const insights = await svc.getDailyInsights(24, true);
    expect(insights.regime_distribution.TREND).toBe(2);
    expect(insights.regime_distribution.RANGE).toBe(1);
  });

  it('getDailyInsights caches within 5 minutes', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    await svc.getDailyInsights(24, false);
    await svc.getDailyInsights(24, false);
    expect(liveRepo.find).toHaveBeenCalledTimes(1);
  });

  it('getDailyInsights bypasses cache with force=true', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    await svc.getDailyInsights(24, false);
    await svc.getDailyInsights(24, true);
    expect(liveRepo.find).toHaveBeenCalledTimes(2);
  });

  it('getRegimeHeatmap returns cells for each symbol×timeframe', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const heat = await svc.getRegimeHeatmap();
    expect(heat.symbols).toContain('BTCUSDT');
    expect(heat.symbols).toContain('ETHUSDT');
    expect(heat.timeframes.length).toBeGreaterThan(0);
    expect(heat.cells.length).toBe(heat.symbols.length * heat.timeframes.length);
  });

  it('getStrategyLeaderboard aggregates per strategy', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const board = await svc.getStrategyLeaderboard();
    const rsi = board.find((b) => b.strategy_family === 'rsi_trend');
    expect(rsi?.live_signal_count).toBe(2);
    expect(rsi?.ai_approved_count).toBe(1);
    expect(rsi?.ai_approval_rate).toBeCloseTo(0.5, 2);
  });

  it('getStrategyLeaderboard sorts by live_signal_count descending', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const board = await svc.getStrategyLeaderboard();
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].live_signal_count).toBeGreaterThanOrEqual(board[i].live_signal_count);
    }
  });

  it('falls back to deterministic summary when AI is unavailable', async () => {
    const coach = new AICoachService();
    const svc = new AIInsightsService(liveRepo, perfRepo, coach);
    const insights = await svc.getDailyInsights(24, true);
    expect(insights.ai_summary).toContain('sinyal');
    expect(insights.recommendations.length).toBe(3);
  });
});
