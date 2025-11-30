import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';

export interface LiveSignalFilters {
  symbol?: string;
  timeframe?: string;
  from?: string;
  to?: string;
  status?: string;
  strategyFamily?: string;
  confidenceMin?: number;
  confidenceMax?: number;
  range?: 'last_1h' | 'last_4h' | 'last_24h';
}

export interface LiveSignalListResponse {
  items: LiveSignal[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable()
export class LiveSignalService {
  private readonly logger = new Logger(LiveSignalService.name);

  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
  ) {}

  async createSignal(signal: Partial<LiveSignal>): Promise<LiveSignal> {
    const entity = this.liveSignalRepo.create(signal);
    return this.liveSignalRepo.save(entity);
  }

  async listSignals(
    filters: LiveSignalFilters,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<LiveSignalListResponse> {
    const queryBuilder = this.liveSignalRepo.createQueryBuilder('signal');

    if (filters.symbol) {
      queryBuilder.andWhere('signal.symbol = :symbol', { symbol: filters.symbol });
    }

    if (filters.timeframe) {
      queryBuilder.andWhere('signal.timeframe = :timeframe', { timeframe: filters.timeframe });
    }

    if (filters.status) {
      queryBuilder.andWhere('signal.status = :status', { status: filters.status });
    }

    if (filters.strategyFamily) {
      queryBuilder.andWhere('signal.strategy_family = :strategyFamily', {
        strategyFamily: filters.strategyFamily,
      });
    }

    if (filters.confidenceMin !== undefined) {
      queryBuilder.andWhere('signal.confidence_score >= :confidenceMin', {
        confidenceMin: filters.confidenceMin,
      });
    }

    if (filters.confidenceMax !== undefined) {
      queryBuilder.andWhere('signal.confidence_score <= :confidenceMax', {
        confidenceMax: filters.confidenceMax,
      });
    }

    if (filters.range) {
      const now = new Date();
      const hours = filters.range === 'last_1h' ? 1 : filters.range === 'last_4h' ? 4 : 24;
      const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
      queryBuilder.andWhere('signal.timestamp_utc >= :since', { since });
    } else {
      if (filters.from) {
        queryBuilder.andWhere('signal.timestamp_utc >= :from', { from: new Date(filters.from) });
      }
      if (filters.to) {
        queryBuilder.andWhere('signal.timestamp_utc <= :to', { to: new Date(filters.to) });
      }
    }

    queryBuilder.orderBy('signal.timestamp_utc', 'DESC');

    const skip = (page - 1) * pageSize;
    const [items, total] = await queryBuilder.skip(skip).take(pageSize).getManyAndCount();

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async updateSignalStatus(
    id: string,
    status: string,
    notes?: string,
  ): Promise<void> {
    await this.liveSignalRepo.update({ id }, { status, notes });
    this.logger.log(`Live signal ${id} status updated to ${status}`);
  }
}
