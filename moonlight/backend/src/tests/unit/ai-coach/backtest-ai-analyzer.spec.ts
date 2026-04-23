import { BacktestAIAnalyzerService } from '../../../ai-coach/backtest-ai-analyzer.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';

describe('BacktestAIAnalyzerService', () => {
  const baseStats = {
    runId: 'RUN_1',
    total_trades: 120,
    win_rate: 0.58,
    max_drawdown: 0.12,
    profit_factor: 1.45,
    symbols: ['BTCUSDT'],
  };

  beforeEach(() => {
    delete process.env.EMERGENT_LLM_KEY;
  });

  it('falls back deterministically when LLM is unavailable', async () => {
    const coach = new AICoachService();
    const svc = new BacktestAIAnalyzerService(coach);
    const r = await svc.analyze(baseStats);
    expect(r.runId).toBe('RUN_1');
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.weaknesses.length).toBeGreaterThan(0);
    expect(r.recommendations.length).toBe(3);
    expect(['low', 'medium', 'high']).toContain(r.riskLevel);
    expect(r.model).toBe('deterministic-fallback');
  });

  it('marks high risk when drawdown > 30%', async () => {
    const coach = new AICoachService();
    const svc = new BacktestAIAnalyzerService(coach);
    const r = await svc.analyze({ ...baseStats, max_drawdown: 0.35 });
    expect(r.riskLevel).toBe('high');
  });

  it('marks low risk when drawdown and profit factor healthy', async () => {
    const coach = new AICoachService();
    const svc = new BacktestAIAnalyzerService(coach);
    const r = await svc.analyze({ ...baseStats, max_drawdown: 0.05, profit_factor: 2.0 });
    expect(r.riskLevel).toBe('low');
  });

  it('parses structured LLM JSON output when coach is available', async () => {
    process.env.EMERGENT_LLM_KEY = 'stub';
    const coach = new AICoachService();
    const svc = new BacktestAIAnalyzerService(coach);
    (coach as any).chat = jest.fn().mockResolvedValue(
      JSON.stringify({
        strengths: ['yeterli pf'],
        weaknesses: ['yüksek dd'],
        regimeFit: 'RANGE piyasa uyumlu',
        recommendations: ['dd azalt', 'filtre ekle'],
        riskLevel: 'medium',
        suggestedParameterBands: [{ param: 'rsi_period', min: 10, max: 20, note: 'clas.' }],
      }),
    );
    const r = await svc.analyze(baseStats);
    expect(r.riskLevel).toBe('medium');
    expect(r.strengths).toContain('yeterli pf');
    expect(r.suggestedParameterBands).toHaveLength(1);
    expect(r.model).not.toBe('deterministic-fallback');
  });

  it('returns fallback when LLM emits invalid JSON', async () => {
    process.env.EMERGENT_LLM_KEY = 'stub';
    const coach = new AICoachService();
    const svc = new BacktestAIAnalyzerService(coach);
    (coach as any).chat = jest.fn().mockResolvedValue('not json');
    const r = await svc.analyze(baseStats);
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.raw).toBe('not json');
  });
});
