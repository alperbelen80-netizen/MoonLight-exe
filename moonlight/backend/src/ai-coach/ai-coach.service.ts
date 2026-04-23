import { Injectable, Logger } from '@nestjs/common';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIFeedValidationInput {
  providers: Array<{
    name: string;
    connected: boolean;
    latencyMs: number | null;
    lastError: string | null;
    score: number;
  }>;
  deterministicChoice: string;
}

export interface AIFeedValidationResult {
  approved: boolean;
  chosenProvider: string;
  confidence: number;
  reason: string;
  raw: string;
}

export interface AIStrategyAnalysisInput {
  strategyId: string;
  totalSignals: number;
  executedSignals: number;
  winRate: number;
  avgPnl: number;
  avgConfidence: number;
  consecutiveLosses: number;
  regime?: string;
}

/**
 * AI Coach Service
 *
 * Thin client on top of the Emergent LLM Gateway (OpenAI-compatible).
 * Uses `gemini-2.5-flash` by default – the user specifically asked for
 * Gemma E4B, but that SKU is not currently exposed by the gateway, so
 * we fall back to Gemini 2.5 Flash (same Google family, production
 * quality, low-latency).
 *
 * Two roles:
 *  1. `validateFeedSelection()` – fail-closed guardrail for the
 *     automatic data-feed provider selection. When the LLM fails or
 *     returns low confidence the system does NOT switch.
 *  2. `analyzeStrategy()` – short natural-language strategy coaching
 *     used by the UI coach panel.
 */
@Injectable()
export class AICoachService {
  private readonly logger = new Logger(AICoachService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly gatewayUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    this.apiKey = process.env.EMERGENT_LLM_KEY || '';
    this.model = process.env.AI_COACH_MODEL || 'gemini-2.5-flash';
    this.gatewayUrl =
      process.env.AI_COACH_GATEWAY_URL ||
      'https://integrations.emergentagent.com/llm/chat/completions';
    this.timeoutMs = parseInt(process.env.AI_COACH_TIMEOUT_MS || '15000', 10);

    if (!this.apiKey) {
      this.logger.warn('EMERGENT_LLM_KEY is not set – AI Coach will operate in DEGRADED mode');
    } else {
      this.logger.log(`AI Coach ready (model=${this.model})`);
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  getModelName(): string {
    return this.model;
  }

  async chat(messages: AIChatMessage[], maxTokens = 800): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('AI_COACH_NOT_CONFIGURED: EMERGENT_LLM_KEY missing');
    }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.normalizedModel(),
          messages,
          max_tokens: maxTokens,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });

      const raw = await res.text();
      if (!res.ok) {
        throw new Error(`AI gateway HTTP ${res.status}: ${raw.slice(0, 500)}`);
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`AI gateway returned non-JSON: ${raw.slice(0, 200)}`);
      }

      const content = parsed?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        // Some gateway responses place text under a different key – try tool_calls fallback.
        const fallback = parsed?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (typeof fallback === 'string' && fallback.length > 0) {
          return fallback;
        }
        throw new Error('AI gateway returned empty content');
      }
      return content;
    } finally {
      clearTimeout(to);
    }
  }

  /**
   * Fail-closed feed validation.
   * - If LLM is not configured or fails → returns approved=false, confidence=0.
   * - Parses a strict JSON block: {approved, chosenProvider, confidence, reason}.
   */
  async validateFeedSelection(input: AIFeedValidationInput): Promise<AIFeedValidationResult> {
    if (!this.isAvailable()) {
      return {
        approved: false,
        chosenProvider: input.deterministicChoice,
        confidence: 0,
        reason: 'AI validation unavailable (EMERGENT_LLM_KEY not set) – applying fail-closed policy',
        raw: '',
      };
    }

    const sys =
      'You output ONLY a single valid JSON object, nothing else. ' +
      'Audit the deterministic data-feed provider choice for an options trading OS. ' +
      'Schema: {"approved": boolean, "chosenProvider": string, "confidence": number, "reason": string}. ' +
      'Rules: confidence between 0 and 1. If no provider is connected AND chosen is MOCK_LIVE, approved=true with confidence>=0.7. ' +
      'If a LIVE provider is connected with low latency, prefer it over MOCK. ' +
      'Keep reason under 200 chars. Do not use markdown, do not add prose, return JSON only.';

    const payload = JSON.stringify({
      providers: input.providers,
      deterministicChoice: input.deterministicChoice,
    });

    let raw = '';
    try {
      raw = await this.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: payload },
        ],
        1500,
      );
    } catch (err: any) {
      this.logger.warn(`validateFeedSelection LLM failure: ${err?.message}`);
      return {
        approved: false,
        chosenProvider: input.deterministicChoice,
        confidence: 0,
        reason: `LLM error (fail-closed): ${err?.message || 'unknown'}`,
        raw: '',
      };
    }

    const parsed = this.extractJson(raw);
    if (!parsed) {
      return {
        approved: false,
        chosenProvider: input.deterministicChoice,
        confidence: 0,
        reason: `LLM response could not be parsed as JSON (fail-closed)`,
        raw,
      };
    }

    const approved = Boolean(parsed.approved);
    const chosenProvider =
      typeof parsed.chosenProvider === 'string' && parsed.chosenProvider.length > 0
        ? parsed.chosenProvider
        : input.deterministicChoice;
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : '';

    return { approved, chosenProvider, confidence, reason, raw };
  }

  async analyzeStrategy(input: AIStrategyAnalysisInput): Promise<string> {
    const sys =
      'You are a pragmatic trading-strategy coach. Respond in Turkish. Keep it to 3-5 bullet points. ' +
      'Identify 1 clear strength, 1 clear risk and 1 concrete next action for the given strategy stats. ' +
      'Never invent data that is not in the payload. No financial advice disclaimers.';

    const payload = JSON.stringify(input);
    if (!this.isAvailable()) {
      return '(AI Coach pasif – EMERGENT_LLM_KEY tanımlı değil)';
    }
    try {
      return await this.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: payload },
        ],
        600,
      );
    } catch (err: any) {
      this.logger.warn(`analyzeStrategy LLM failure: ${err?.message}`);
      return `(AI Coach şu an cevap veremedi: ${err?.message || 'bilinmeyen hata'})`;
    }
  }

  async freeformCoaching(userPrompt: string, context?: Record<string, any>): Promise<string> {
    const sys =
      'You are MoonLight AI Coach. Respond in Turkish unless the user clearly uses another language. ' +
      'You have read-only access to the OS statistics provided in CONTEXT. ' +
      'Keep responses concise (max 8 short sentences). ' +
      'If a request requires placing real orders or bypassing risk limits, refuse politely.';

    const ctxText = context ? `CONTEXT: ${JSON.stringify(context)}` : '';
    const userBlock = ctxText ? `${ctxText}\n\nUSER: ${userPrompt}` : userPrompt;

    if (!this.isAvailable()) {
      return '(AI Coach pasif – sistem yöneticisine EMERGENT_LLM_KEY eklenmesi için başvurun.)';
    }

    try {
      return await this.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: userBlock },
        ],
        700,
      );
    } catch (err: any) {
      return `(AI Coach hatası: ${err?.message || 'bilinmeyen'})`;
    }
  }

  private normalizedModel(): string {
    // Gateway expects gemini models to be prefixed with 'gemini/'.
    if (this.model.startsWith('gemini') && !this.model.startsWith('gemini/')) {
      return `gemini/${this.model}`;
    }
    return this.model;
  }

  private extractJson(raw: string): any | null {
    if (!raw) return null;
    // Accept raw JSON or ```json fenced blocks.
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to extract first {...} block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
}
