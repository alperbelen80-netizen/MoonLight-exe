import { MoEGateService } from '../../../execution/moe-gate.service';
import { GlobalMoEOrchestratorService } from '../../../moe-brain/global-moe-orchestrator.service';
import { MoEDecision } from '../../../moe-brain/shared/moe.enums';

function makeOrch(
  result?: Partial<Awaited<ReturnType<GlobalMoEOrchestratorService['evaluate']>>>,
  throws?: Error,
): GlobalMoEOrchestratorService {
  return {
    evaluate: jest.fn().mockImplementation(() => {
      if (throws) return Promise.reject(throws);
      return Promise.resolve({
        decision: MoEDecision.ALLOW,
        confidence: 0.8,
        reasonCodes: [],
        brains: [],
        finalWeights: { ceo: 0.4, trade: 0.4, test: 0.2 },
        timestampUtc: new Date().toISOString(),
        ...result,
      });
    }),
    getWeights: () => ({ ceo: 0.4, trade: 0.4, test: 0.2 }),
  } as unknown as GlobalMoEOrchestratorService;
}

const ctx = {
  signalId: 'g1',
  symbol: 'EURUSD',
  timeframe: '15m',
  direction: 'LONG' as const,
  timestampUtc: new Date().toISOString(),
};

describe('MoEGateService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows when gate is disabled (default)', async () => {
    delete process.env.MOE_GATE_ENABLED;
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.VETO }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(true);
    expect(r.decision).toBe('DISABLED');
  });

  it('allows on ALLOW', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.ALLOW }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(true);
    expect(r.decision).toBe(MoEDecision.ALLOW);
  });

  it('blocks on VETO', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.VETO }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(false);
    expect(r.decision).toBe(MoEDecision.VETO);
  });

  it('blocks on SKIP', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.SKIP }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(false);
  });

  it('allows MANUAL_REVIEW when not strict', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    delete process.env.MOE_GATE_STRICT;
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.MANUAL_REVIEW }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(true);
  });

  it('blocks MANUAL_REVIEW when strict', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    process.env.MOE_GATE_STRICT = 'true';
    const gate = new MoEGateService(makeOrch({ decision: MoEDecision.MANUAL_REVIEW }));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(false);
  });

  it('fail-open on orchestrator error when non-strict', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    delete process.env.MOE_GATE_STRICT;
    const gate = new MoEGateService(makeOrch(undefined, new Error('network')));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(true);
    expect(r.decision).toBe('ERRORED');
    expect(r.reasonCodes).toContain('NONSTRICT_ALLOW');
  });

  it('fail-closed on orchestrator error when strict', async () => {
    process.env.MOE_GATE_ENABLED = 'true';
    process.env.MOE_GATE_STRICT = 'true';
    const gate = new MoEGateService(makeOrch(undefined, new Error('network')));
    const r = await gate.gate(ctx);
    expect(r.allow).toBe(false);
    expect(r.reasonCodes).toContain('STRICT_BLOCK');
  });
});
