import { parseLlmExperts } from '../../../moe-brain/experts/llm-persona';
import { ExpertRole } from '../../../moe-brain/shared/moe.enums';

describe('parseLlmExperts', () => {
  const allowed = [ExpertRole.TREND, ExpertRole.VOLATILITY];

  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({
      experts: [
        { role: 'TREND', vote: 'APPROVE', confidence: 0.8, rationale: 'ok', reasonCodes: ['A'] },
        { role: 'VOLATILITY', vote: 'REJECT', confidence: 0.4, rationale: 'no', reasonCodes: ['B'] },
      ],
    });
    const out = parseLlmExperts(raw, allowed);
    expect(out.ok).toBe(true);
    expect(out.outputs[ExpertRole.TREND]?.vote).toBe('APPROVE');
    expect(out.outputs[ExpertRole.VOLATILITY]?.vote).toBe('REJECT');
  });

  it('strips leading ```json code fences', () => {
    const raw = '```json\n{"experts":[{"role":"TREND","vote":"APPROVE","confidence":0.7}]}\n```';
    const out = parseLlmExperts(raw, allowed);
    expect(out.ok).toBe(true);
    expect(out.outputs[ExpertRole.TREND]?.vote).toBe('APPROVE');
  });

  it('ignores unknown roles', () => {
    const raw = JSON.stringify({
      experts: [
        { role: 'FAKE_ROLE', vote: 'APPROVE', confidence: 0.5 },
        { role: 'TREND', vote: 'APPROVE', confidence: 0.5 },
      ],
    });
    const out = parseLlmExperts(raw, allowed);
    expect(Object.keys(out.outputs).length).toBe(1);
  });

  it('clamps confidence to [0,1]', () => {
    const raw = JSON.stringify({
      experts: [
        { role: 'TREND', vote: 'APPROVE', confidence: 99 },
        { role: 'VOLATILITY', vote: 'REJECT', confidence: -5 },
      ],
    });
    const out = parseLlmExperts(raw, allowed);
    expect(out.outputs[ExpertRole.TREND]?.confidence).toBe(1);
    expect(out.outputs[ExpertRole.VOLATILITY]?.confidence).toBe(0);
  });

  it('defaults invalid vote to NEUTRAL', () => {
    const raw = JSON.stringify({
      experts: [{ role: 'TREND', vote: 'MAYBE', confidence: 0.5 }],
    });
    const out = parseLlmExperts(raw, allowed);
    expect(out.outputs[ExpertRole.TREND]?.vote).toBe('NEUTRAL');
  });

  it('fails gracefully on malformed JSON', () => {
    const out = parseLlmExperts('not json', allowed);
    expect(out.ok).toBe(false);
    expect(out.outputs).toEqual({});
  });
});
