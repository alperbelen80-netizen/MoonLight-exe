import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';

export interface JournalEntry {
  id: string;
  timestamp_utc: string;
  symbol: string;
  timeframe: string;
  direction: string;
  confidence_score: number;
  status: string;
  strategy_family: string;
  ai_verdict: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_reasoned_at_utc: string | null;
  notes: string | null;
  entry_price: number | null;
  current_price: number | null;
}

@Controller('journal')
export class JournalController {
  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
  ) {}

  @Get()
  async list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
    @Query('strategy') strategy?: string,
    @Query('verdict') verdict?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.max(1, Math.min(parseInt(limitRaw || '100', 10), 500));
    const dFrom = from ? new Date(from) : new Date(Date.now() - 24 * 3600_000);
    const dTo = to ? new Date(to) : new Date();
    const where: any = { timestamp_utc: Between(dFrom, dTo) };
    if (status) where.status = status.toUpperCase();
    if (symbol) where.symbol = symbol;
    if (strategy) where.strategy_family = Like(`%${strategy}%`);
    if (verdict) where.ai_verdict = verdict.toUpperCase();

    const rows = await this.liveSignalRepo.find({
      where,
      order: { timestamp_utc: 'DESC' },
      take: limit,
    });

    const items: JournalEntry[] = rows.map((r) => ({
      id: r.id,
      timestamp_utc: r.timestamp_utc?.toISOString?.() ?? new Date(r.timestamp_utc as any).toISOString(),
      symbol: r.symbol,
      timeframe: r.timeframe,
      direction: r.direction,
      confidence_score: r.confidence_score,
      status: r.status,
      strategy_family: r.strategy_family,
      ai_verdict: r.ai_verdict ?? null,
      ai_confidence: r.ai_confidence ?? null,
      ai_reasoning: r.ai_reasoning ?? null,
      ai_reasoned_at_utc: r.ai_reasoned_at_utc ? r.ai_reasoned_at_utc.toISOString() : null,
      notes: r.notes ?? null,
      entry_price: r.entry_price ?? null,
      current_price: r.current_price ?? null,
    }));

    return {
      count: items.length,
      from_utc: dFrom.toISOString(),
      to_utc: dTo.toISOString(),
      items,
    };
  }

  @Get('stats')
  async stats(@Query('hours') hoursRaw?: string) {
    const hours = Math.max(1, Math.min(parseInt(hoursRaw || '24', 10), 168));
    const since = new Date(Date.now() - hours * 3600_000);
    const rows = await this.liveSignalRepo.find({
      where: { timestamp_utc: Between(since, new Date()) },
      take: 5000,
    });
    const stats = {
      total: rows.length,
      by_status: {} as Record<string, number>,
      by_verdict: {} as Record<string, number>,
      by_direction: {} as Record<string, number>,
    };
    for (const r of rows) {
      stats.by_status[r.status] = (stats.by_status[r.status] || 0) + 1;
      const v = r.ai_verdict || 'UNKNOWN';
      stats.by_verdict[v] = (stats.by_verdict[v] || 0) + 1;
      stats.by_direction[r.direction] = (stats.by_direction[r.direction] || 0) + 1;
    }
    return { window_hours: hours, generated_at_utc: new Date().toISOString(), ...stats };
  }
}
