import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AICoachService } from './ai-coach.service';
import { LiveSignal } from '../database/entities/live-signal.entity';

export interface AIReasoningInput {
  signalId: string;
  symbol: string;
  timeframe: string;
  direction: string;
  strategy: string;
  confidence: number;
  regime?: string;
  adx?: number;
  entryPrice?: number;
  expectedEV?: number;
  payoutPct?: number;
}

export interface AIReasoningResult {
  approved: boolean;
  confidence: number; // 0..1
  reasoning: string;
  riskFactors: string[];
  expectedWR: number | null;
  verdict: 'APPROVED' | 'REJECTED' | 'UNKNOWN';
  raw: string;
}

interface RateBucket {
  tokens: number;
  lastRefillTs: number;
}

/**
 * AI Reasoning Layer (v1.8)
 *
 * Runs a second-opinion AI audit on every freshly produced live signal.
 * Persisted verdict can be used by the AI Guard to SKIP weak signals
 * before they reach the execution stage (fail-closed policy).
 *
 * Guarantees:
 *  - Rate-limited (token bucket, default 30 analyses / minute)
 *  - Timeout-safe (AICoachService already enforces 15s upstream)
 *  - Never throws upstream – returns verdict=UNKNOWN when LLM is
 *    unavailable or parses fail.
 */
@Injectable()
export class AIReasoningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIReasoningService.name);
  private readonly bucket: RateBucket;
  private readonly maxPerMinute: number;
  private readonly enabled: boolean;
  private readonly strictGuard: boolean;
  private readonly autoBatchEnabled: boolean;
  private readonly autoBatchIntervalMs: number;
  private readonly autoBatchSize: number;
  private autoBatchTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly coach: AICoachService,
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
  ) {
    this.enabled = (process.env.AI_REASONING_ENABLED || 'true') !== 'false';
    this.strictGuard = process.env.AI_GUARD_STRICT === 'true';
    this.maxPerMinute = parseInt(process.env.AI_REASONING_RATE_PER_MIN || '30', 10);
    this.autoBatchEnabled = (process.env.AI_REASONING_AUTO_BATCH || 'true') !== 'false';
    this.autoBatchIntervalMs = parseInt(process.env.AI_REASONING_BATCH_INTERVAL_MS || '30000', 10);
    this.autoBatchSize = parseInt(process.env.AI_REASONING_BATCH_SIZE || '5', 10);
    this.bucket = { tokens: this.maxPerMinute, lastRefillTs: Date.now() };
  }

  onModuleInit(): void {
    if (!this.autoBatchEnabled) {
      this.logger.log('AI reasoning auto-batch DISABLED');
      return;
    }
    if (!this.coach.isAvailable()) {
      this.logger.warn('AI reasoning auto-batch skipped: coach unavailable (no EMERGENT_LLM_KEY)');
      return;
    }
    this.autoBatchTimer = setInterval(() => {
      this.reasonBatch(this.autoBatchSize).catch((err) => {
        this.logger.warn(`Auto-batch reasoning failed: ${err?.message}`);
      });
    }, this.autoBatchIntervalMs);
    this.logger.log(
      `AI reasoning auto-batch ENABLED (interval=${this.autoBatchIntervalMs}ms, size=${this.autoBatchSize})`,
    );
  }

  onModuleDestroy(): void {
    if (this.autoBatchTimer) clearInterval(this.autoBatchTimer);
  }

  isEnabled(): boolean {
    return this.enabled && this.coach.isAvailable();
  }

  isStrictGuard(): boolean {
    return this.strictGuard;
  }

  getRateStatus(): { remaining: number; perMinute: number; circuitOpen: boolean } {
    this.refillBucket();
    return {
      remaining: this.bucket.tokens,
      perMinute: this.maxPerMinute,
      circuitOpen: Date.now() < this.circuitOpenUntil,
    };
  }

  /**
   * Analyse a live signal. Does NOT throw on failure – returns
   * verdict=UNKNOWN so callers can apply their own fail-closed policy.
   */
  async reasonAboutSignal(input: AIReasoningInput): Promise<AIReasoningResult> {
    if (!this.isEnabled()) {
      return this.unknown('AI reasoning disabled or LLM unavailable');
    }

    if (Date.now() < this.circuitOpenUntil) {
      return this.unknown('AI reasoning circuit breaker OPEN (cooldown)');
    }

    if (!this.tryTake()) {
      return this.unknown('AI reasoning rate-limited');
    }

    const sys =
      'Return ONLY one JSON object, no markdown, no fences. ' +
      'Schema: {"approved":boolean,"confidence":number,"reasoning":string,"riskFactors":string[],"expectedWR":number}. ' +
      'confidence/expectedWR in [0,1]. reasoning <=160 chars Turkish. riskFactors<=3 short items. ' +
      'Approve only if direction matches regime and confidence/EV are not trivially low.';

    const payload = JSON.stringify(input);
    let raw = '';
    try {
      raw = await this.coach.chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: payload },
        ],
        3000,
      );
      this.recordSuccess();
    } catch (err: any) {
      this.recordFailure(err?.message);
      return this.unknown(`LLM error: ${err?.message || 'unknown'}`);
    }

    const parsed = this.extractJson(raw);
    if (!parsed) {
      return this.unknown('LLM output not JSON-parsable', raw);
    }

    const approved = Boolean(parsed.approved);
    const confidence = this.clamp01(parsed.confidence);
    const expectedWR = this.clamp01(parsed.expectedWR);
    const reasoning =
      typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : '';
    const riskFactors = Array.isArray(parsed.riskFactors)
      ? parsed.riskFactors.map((r: any) => String(r)).slice(0, 6)
      : [];

    return {
      approved,
      confidence,
      reasoning,
      riskFactors,
      expectedWR: Number.isFinite(expectedWR) ? expectedWR : null,
      verdict: approved ? 'APPROVED' : 'REJECTED',
      raw,
    };
  }

  /**
   * Convenience: reason + persist verdict on the LiveSignal row.
   */
  async reasonAndPersist(signalId: string, input: AIReasoningInput): Promise<AIReasoningResult> {
    const result = await this.reasonAboutSignal(input);
    try {
      const reasoningBlob = JSON.stringify({
        reasoning: result.reasoning,
        riskFactors: result.riskFactors,
        expectedWR: result.expectedWR,
      });
      await this.liveSignalRepo.update(
        { id: signalId },
        {
          ai_verdict: result.verdict,
          ai_confidence: result.confidence,
          ai_reasoning: reasoningBlob,
          ai_reasoned_at_utc: new Date(),
          // AI Guard: mark signal as SKIPPED if we reject it in strict mode.
          ...(this.strictGuard && result.verdict === 'REJECTED'
            ? { status: 'SKIPPED' }
            : {}),
        },
      );
    } catch (err: any) {
      this.logger.warn(`Failed to persist AI reasoning for ${signalId}: ${err?.message}`);
    }
    return result;
  }

  /**
   * Batch: reason the latest N still-PENDING signals.
   */
  async reasonBatch(limit = 10): Promise<
    { signalId: string; verdict: string; confidence: number }[]
  > {
    const pending = await this.liveSignalRepo.find({
      where: [{ ai_verdict: 'UNKNOWN' }, { ai_verdict: 'PENDING' }],
      order: { timestamp_utc: 'DESC' },
      take: Math.max(1, Math.min(limit, 50)),
    });

    const out: { signalId: string; verdict: string; confidence: number }[] = [];
    for (const s of pending) {
      const input: AIReasoningInput = {
        signalId: s.id,
        symbol: s.symbol,
        timeframe: s.timeframe,
        direction: s.direction,
        strategy: s.strategy_family,
        confidence: s.confidence_score,
        entryPrice: s.entry_price,
        expectedEV: (s.expected_wr_band_min + s.expected_wr_band_max) / 2,
      };
      const r = await this.reasonAndPersist(s.id, input);
      out.push({ signalId: s.id, verdict: r.verdict, confidence: r.confidence });
    }
    return out;
  }

  // ------- Internal helpers -------

  private tryTake(): boolean {
    this.refillBucket();
    if (this.bucket.tokens <= 0) return false;
    this.bucket.tokens -= 1;
    return true;
  }

  private refillBucket(): void {
    const now = Date.now();
    const elapsedMs = now - this.bucket.lastRefillTs;
    if (elapsedMs <= 0) return;
    const refill = (elapsedMs / 60000) * this.maxPerMinute;
    this.bucket.tokens = Math.min(this.maxPerMinute, this.bucket.tokens + refill);
    this.bucket.lastRefillTs = now;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  private recordFailure(msg?: string): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 5) {
      this.circuitOpenUntil = Date.now() + 60_000; // 60s cooldown
      this.consecutiveFailures = 0;
      this.logger.warn(`AI reasoning circuit breaker OPEN for 60s (last error: ${msg})`);
    }
  }

  private unknown(reason: string, raw = ''): AIReasoningResult {
    return {
      approved: false,
      confidence: 0,
      reasoning: reason,
      riskFactors: [],
      expectedWR: null,
      verdict: 'UNKNOWN',
      raw,
    };
  }

  private clamp01(v: any): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  private extractJson(raw: string): any | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
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
