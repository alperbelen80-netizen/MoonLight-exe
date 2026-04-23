import { AICoachService } from '../../../ai-coach/ai-coach.service';

describe('AICoachService', () => {
  let originalKey: string | undefined;
  let originalModel: string | undefined;

  beforeEach(() => {
    originalKey = process.env.EMERGENT_LLM_KEY;
    originalModel = process.env.AI_COACH_MODEL;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.EMERGENT_LLM_KEY = originalKey;
    else delete process.env.EMERGENT_LLM_KEY;
    if (originalModel !== undefined) process.env.AI_COACH_MODEL = originalModel;
    else delete process.env.AI_COACH_MODEL;
  });

  it('isAvailable returns false when EMERGENT_LLM_KEY is missing', () => {
    delete process.env.EMERGENT_LLM_KEY;
    const svc = new AICoachService();
    expect(svc.isAvailable()).toBe(false);
  });

  it('isAvailable returns true when key is set', () => {
    process.env.EMERGENT_LLM_KEY = 'test-key';
    const svc = new AICoachService();
    expect(svc.isAvailable()).toBe(true);
  });

  it('validateFeedSelection returns fail-closed when key is missing', async () => {
    delete process.env.EMERGENT_LLM_KEY;
    const svc = new AICoachService();
    const result = await svc.validateFeedSelection({
      providers: [
        { name: 'MOCK_LIVE', connected: true, latencyMs: 5, lastError: null, score: 10 },
      ],
      deterministicChoice: 'MOCK_LIVE',
    });
    expect(result.approved).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.chosenProvider).toBe('MOCK_LIVE');
    expect(result.reason).toContain('fail-closed');
  });

  it('analyzeStrategy returns degraded message without key', async () => {
    delete process.env.EMERGENT_LLM_KEY;
    const svc = new AICoachService();
    const text = await svc.analyzeStrategy({
      strategyId: 'rsi2_oversold',
      totalSignals: 10,
      executedSignals: 5,
      winRate: 0.6,
      avgPnl: 2.1,
      avgConfidence: 0.7,
      consecutiveLosses: 0,
    });
    expect(text).toContain('AI Coach');
  });

  it('freeformCoaching returns degraded message without key', async () => {
    delete process.env.EMERGENT_LLM_KEY;
    const svc = new AICoachService();
    const text = await svc.freeformCoaching('Test');
    expect(text).toContain('AI Coach');
  });

  it('getModelName reflects env override', () => {
    process.env.EMERGENT_LLM_KEY = 'test-key';
    process.env.AI_COACH_MODEL = 'gemini-2.5-pro';
    const svc = new AICoachService();
    expect(svc.getModelName()).toBe('gemini-2.5-pro');
  });
});
