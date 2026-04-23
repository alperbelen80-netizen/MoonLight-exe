// Shared utilities for Gemini-powered brains (CEO + TRADE).
// Keeps all brains' LLM calls cohesive: single gateway call per signal,
// JSON-only response expected, strict timeout + parse-safe.
//
// If AICoachService is unavailable OR the LLM call fails, callers should
// fall back to their deterministic experts.

import { Logger } from '@nestjs/common';
import { ExpertOutput } from '../shared/moe.contracts';
import { ExpertRole, ExpertVote } from '../shared/moe.enums';

export interface PersonaBlock {
  role: ExpertRole;
  persona: string; // short persona description
  focus: string; // what the expert looks at
}

export interface LlmExpertParseResult {
  outputs: Partial<Record<ExpertRole, ExpertOutput>>;
  raw: string;
  ok: boolean;
  error?: string;
}

export function buildSystemPrompt(brainName: string, personas: PersonaBlock[]): string {
  const blocks = personas
    .map(
      (p) =>
        `- ${p.role}: persona="${p.persona}"; focus="${p.focus}".`,
    )
    .join('\n');
  return [
    `You are the ${brainName} brain of a fixed-time/binary trading MoE.`,
    `You coordinate ${personas.length} expert personas and must return STRICT JSON only, no prose.`,
    `Experts:`,
    blocks,
    '',
    'Output schema:',
    '{"experts": [{"role": "TREND|...", "vote": "APPROVE|REJECT|NEUTRAL", "confidence": 0..1, "rationale": "<=140 chars", "reasonCodes": ["CODE_A", "CODE_B"]}, ...]}',
    '',
    'Rules:',
    '- confidence MUST be a number between 0 and 1 (inclusive).',
    '- vote MUST be one of APPROVE, REJECT, NEUTRAL.',
    '- If you are unsure, return NEUTRAL with low confidence.',
    '- Do NOT wrap JSON in code fences. Return bare JSON.',
  ].join('\n');
}

export function buildUserPayload(ctx: unknown): string {
  return `Signal context JSON:\n${JSON.stringify(ctx)}`;
}

// Parse a Gemini response into ExpertOutput map. Robust to leading/trailing whitespace,
// code fences, minor format drift.
export function parseLlmExperts(
  raw: string,
  allowedRoles: ExpertRole[],
  logger?: Logger,
): LlmExpertParseResult {
  const out: Partial<Record<ExpertRole, ExpertOutput>> = {};
  try {
    const cleaned = stripCodeFences(raw).trim();
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed?.experts) ? parsed.experts : [];
    for (const item of arr) {
      const role = normalizeRole(item?.role);
      if (!role || !allowedRoles.includes(role)) continue;
      const vote = normalizeVote(item?.vote);
      const conf = normalizeConfidence(item?.confidence);
      const reasonCodes = Array.isArray(item?.reasonCodes)
        ? item.reasonCodes.map((x: unknown) => String(x)).slice(0, 8)
        : [];
      const rationale =
        typeof item?.rationale === 'string' ? item.rationale.slice(0, 280) : undefined;
      out[role] = {
        role,
        vote,
        confidence: conf,
        rationale,
        reasonCodes,
      };
    }
    return { outputs: out, raw, ok: true };
  } catch (err) {
    logger?.warn(`parseLlmExperts failed: ${(err as Error).message}`);
    return { outputs: out, raw, ok: false, error: (err as Error).message };
  }
}

function stripCodeFences(s: string): string {
  // Removes leading ```json and trailing ```
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function normalizeRole(v: unknown): ExpertRole | null {
  if (typeof v !== 'string') return null;
  const upper = v.toUpperCase();
  return (Object.values(ExpertRole) as string[]).includes(upper)
    ? (upper as ExpertRole)
    : null;
}

function normalizeVote(v: unknown): ExpertVote {
  if (typeof v !== 'string') return ExpertVote.NEUTRAL;
  const upper = v.toUpperCase();
  if (upper === 'APPROVE' || upper === 'REJECT' || upper === 'NEUTRAL') {
    return upper as ExpertVote;
  }
  return ExpertVote.NEUTRAL;
}

function normalizeConfidence(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.3;
  return Math.max(0, Math.min(1, n));
}
