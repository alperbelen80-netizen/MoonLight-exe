import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import {
  BacktestRunRequestDTO,
  BacktestRunSummaryDTO,
  BacktestRunDetailDTO,
  BacktestRunStatus,
} from '../shared/dto/backtest.dto';

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    @InjectRepository(BacktestRun)
    private readonly backtestRunRepo: Repository<BacktestRun>,
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
    @InjectQueue('backtest')
    private readonly backtestQueue: Queue,
  ) {}

  async startBacktest(
    dto: BacktestRunRequestDTO,
  ): Promise<BacktestRunSummaryDTO> {
    const runId = `RUN_${uuidv4()}`;
    const now = new Date();

    const run = this.backtestRunRepo.create({
      run_id: runId,
      status: BacktestRunStatus.QUEUED,
      symbols: JSON.stringify(dto.symbols),
      timeframes: JSON.stringify(dto.timeframes),
      strategy_ids: JSON.stringify(dto.strategy_ids),
      from_date: dto.from_date,
      to_date: dto.to_date,
      initial_balance: dto.initial_balance,
      net_pnl: 0,
      win_rate: 0,
      max_drawdown: 0,
      total_trades: 0,
      created_at_utc: now,
      updated_at_utc: now,
    });

    await this.backtestRunRepo.save(run);

    await this.backtestQueue.add('run', { runId, dto }, {
      attempts: 1,
    });

    this.logger.log(`Backtest queued: ${runId}`);

    return this.mapRunToSummary(run);
  }

  async getSummary(runId: string): Promise<BacktestRunSummaryDTO | null> {
    const run = await this.backtestRunRepo.findOne({ where: { run_id: runId } });
    if (!run) {
      return null;
    }
    return this.mapRunToSummary(run);
  }

  async getDetail(runId: string): Promise<BacktestRunDetailDTO | null> {
    const run = await this.backtestRunRepo.findOne({ where: { run_id: runId } });
    if (!run) {
      return null;
    }

    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      take: 50,
      order: { entry_ts_utc: 'ASC' },
    });

    return {
      summary: this.mapRunToSummary(run),
      trades_sample: trades,
    };
  }

  private mapRunToSummary(run: BacktestRun): BacktestRunSummaryDTO {
    return {
      run_id: run.run_id,
      status: run.status as BacktestRunStatus,
      symbols: JSON.parse(run.symbols),
      timeframes: JSON.parse(run.timeframes),
      strategy_ids: JSON.parse(run.strategy_ids),
      from_date: run.from_date,
      to_date: run.to_date,
      total_trades: run.total_trades,
      win_rate: run.win_rate,
      net_pnl: run.net_pnl,
      max_drawdown: run.max_drawdown,
      created_at_utc: run.created_at_utc.toISOString(),
      updated_at_utc: run.updated_at_utc.toISOString(),
    };
  }
}
