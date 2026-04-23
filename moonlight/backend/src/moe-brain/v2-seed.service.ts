import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductExecutionConfig } from '../database/entities/product-execution-config.entity';
import { buildV2SeedRows } from './v2-seed';

export interface V2SeedReport {
  expected: number;
  existing: number;
  inserted: number;
  idempotent: boolean;
}

@Injectable()
export class V2SeedService {
  private readonly logger = new Logger(V2SeedService.name);

  constructor(
    @InjectRepository(ProductExecutionConfig)
    private readonly repo: Repository<ProductExecutionConfig>,
  ) {}

  async seedV2Products(): Promise<V2SeedReport> {
    const rows = buildV2SeedRows();
    const now = new Date();

    // Load existing ids in batch
    const existing = await this.repo.find({ select: ['id'] });
    const existingIds = new Set(existing.map((r) => r.id));

    const toInsert = rows
      .filter((r) => !existingIds.has(r.id))
      .map((r) => ({
        id: r.id,
        symbol: r.symbol,
        tf: r.tf,
        data_enabled: true,
        signal_enabled: true,
        auto_trade_enabled: false, // fail-safe default
        created_at_utc: now,
        updated_at_utc: now,
      }));

    if (toInsert.length === 0) {
      return {
        expected: rows.length,
        existing: existingIds.size,
        inserted: 0,
        idempotent: true,
      };
    }

    // Chunk to avoid SQLite parameter limits.
    const chunkSize = 100;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      await this.repo.insert(chunk);
      inserted += chunk.length;
    }

    this.logger.log(
      `V2 seed complete: expected=${rows.length} existing=${existingIds.size} inserted=${inserted}`,
    );

    return {
      expected: rows.length,
      existing: existingIds.size,
      inserted,
      idempotent: inserted === rows.length - existingIds.size,
    };
  }
}
