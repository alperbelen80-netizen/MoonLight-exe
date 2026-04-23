import { AIReasoningService } from '../../../ai-coach/ai-reasoning.service';
import { AICoachService } from '../../../ai-coach/ai-coach.service';

describe('AIReasoningService', () => {
  const baseInput = {
    signalId: 'SIG_1',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    direction: 'CALL',
    strategy: 'rsi2',
    confidence: 0.7,
  };

  const stubRepo: any = {
    update: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    stubRepo.update.mockClear();
    stubRepo.find.mockClear();
    delete process.env.EMERGENT_LLM_KEY;
    delete process.env.AI_REASONING_AUTO_BATCH;
  });

  it('returns UNKNOWN verdict when LLM is unavailable', async () => {
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    const r = await svc.reasonAboutSignal(baseInput);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.approved).toBe(false);
    expect(r.confidence).toBe(0);
  });

  it('rate-limits repeated calls (bucket drains to 0)', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    process.env.AI_REASONING_RATE_PER_MIN = '2';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    // Force LLM calls to always fail (no real network in unit tests)
    (coach as any).chat = jest.fn().mockRejectedValue(new Error('offline'));

    const r1 = await svc.reasonAboutSignal(baseInput);
    expect(r1.verdict).toBe('UNKNOWN');
    const r2 = await svc.reasonAboutSignal(baseInput);
    expect(r2.verdict).toBe('UNKNOWN');
    // 3rd call: bucket should be empty → rate-limited response
    const r3 = await svc.reasonAboutSignal(baseInput);
    expect(r3.reasoning).toMatch(/rate-limited|disabled|LLM/);
    delete process.env.AI_REASONING_RATE_PER_MIN;
  });

  it('opens circuit breaker after 5 consecutive failures', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    process.env.AI_REASONING_RATE_PER_MIN = '100';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockRejectedValue(new Error('boom'));
    for (let i = 0; i < 6; i++) {
      await svc.reasonAboutSignal(baseInput);
    }
    const status = svc.getRateStatus();
    expect(status.circuitOpen).toBe(true);
    delete process.env.AI_REASONING_RATE_PER_MIN;
  });

  it('parses valid JSON response from LLM correctly', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockResolvedValue(
      '{"approved":true,"confidence":0.82,"reasoning":"Trend aligned","riskFactors":["düşük volatilite"],"expectedWR":0.6}',
    );
    const r = await svc.reasonAboutSignal(baseInput);
    expect(r.verdict).toBe('APPROVED');
    expect(r.approved).toBe(true);
    expect(r.confidence).toBeCloseTo(0.82);
    expect(r.expectedWR).toBeCloseTo(0.6);
    expect(r.riskFactors).toHaveLength(1);
  });

  it('extracts JSON even if wrapped in ```json fences', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockResolvedValue(
      '```json\n{"approved":false,"confidence":0.4,"reasoning":"risk","riskFactors":[],"expectedWR":0.3}\n```',
    );
    const r = await svc.reasonAboutSignal(baseInput);
    expect(r.verdict).toBe('REJECTED');
    expect(r.confidence).toBeCloseTo(0.4);
  });

  it('clamps confidence and expectedWR to [0,1]', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockResolvedValue(
      '{"approved":true,"confidence":1.9,"reasoning":"x","riskFactors":[],"expectedWR":-0.2}',
    );
    const r = await svc.reasonAboutSignal(baseInput);
    expect(r.confidence).toBe(1);
    expect(r.expectedWR).toBe(0);
  });

  it('returns UNKNOWN when JSON cannot be parsed', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockResolvedValue('not json at all');
    const r = await svc.reasonAboutSignal(baseInput);
    expect(r.verdict).toBe('UNKNOWN');
    expect(r.reasoning).toMatch(/not JSON-parsable/);
  });

  it('isStrictGuard reflects env AI_GUARD_STRICT', () => {
    process.env.AI_GUARD_STRICT = 'true';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    expect(svc.isStrictGuard()).toBe(true);
    delete process.env.AI_GUARD_STRICT;
  });

  it('reasonAndPersist writes verdict to repo', async () => {
    process.env.EMERGENT_LLM_KEY = 'fake-key';
    process.env.AI_REASONING_AUTO_BATCH = 'false';
    const coach = new AICoachService();
    const svc = new AIReasoningService(coach, stubRepo);
    (coach as any).chat = jest.fn().mockResolvedValue(
      '{"approved":true,"confidence":0.7,"reasoning":"ok","riskFactors":[],"expectedWR":0.55}',
    );
    await svc.reasonAndPersist('SIG_1', baseInput);
    expect(stubRepo.update).toHaveBeenCalledWith(
      { id: 'SIG_1' },
      expect.objectContaining({ ai_verdict: 'APPROVED', ai_confidence: 0.7 }),
    );
  });
});
