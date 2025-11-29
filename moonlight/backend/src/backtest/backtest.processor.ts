import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { BacktestRunRequestDTO, BacktestRunStatus } from '../shared/dto/backtest.dto';
import { ReplayRunnerService } from './replay-runner.service';

@Processor('backtest')
export class BacktestProcessor {
  private readonly logger = new Logger(BacktestProcessor.name);

  constructor(
    @InjectRepository(BacktestRun)
    private readonly backtestRunRepo: Repository<BacktestRun>,
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
    private readonly replayRunner: ReplayRunnerService,
  ) {}

  @Process('run')
  async handleBacktestRun(
    job: Job<{ runId: string; dto: BacktestRunRequestDTO; profileId?: string }>,
  ): Promise<void> {
    const { runId, dto, profileId } = job.data;

    this.logger.log(`Processing backtest run: ${runId}`);

    try {
      await this.backtestRunRepo.update(
        { run_id: runId },
        { status: BacktestRunStatus.RUNNING },
      );

      const result = await this.replayRunner.runBacktest({ runId, request: dto, profileId });

      const tradeEntities = result.trades.map((t) =>
        this.backtestTradeRepo.create({
          run_id: runId,
          trade_uid: t.trade_uid,
          symbol: t.symbol,
          tf: t.tf,
          strategy_id: t.strategy_id,
          entry_ts_utc: new Date(t.entry_ts_utc),
          exit_ts_utc: new Date(t.exit_ts_utc),
          direction: t.direction,
          stake_amount: t.stake_amount,
          gross_pnl: t.gross_pnl,
          net_pnl: t.net_pnl,
          outcome: t.outcome,
          payout_ratio: t.payout_ratio,
          health_score: t.health_score,
        }),
      );

      await this.backtestTradeRepo.save(tradeEntities);

      await this.backtestRunRepo.update(
        { run_id: runId },
        {
          status: BacktestRunStatus.COMPLETED,
          total_trades: result.total_trades,
          win_rate: result.win_rate,
          net_pnl: result.net_pnl,
          max_drawdown: result.max_drawdown,
          blocked_by_risk_count: result.blocked_by_risk_count,
          updated_at_utc: new Date(),
        },
      );

      this.logger.log(`Backtest run ${runId} completed successfully`);
    } catch (error: any) {
      this.logger.error(
        `Backtest run ${runId} failed: ${error?.message || String(error)}`,
      );

      await this.backtestRunRepo.update(
        { run_id: runId },
        {
          status: BacktestRunStatus.FAILED,
          updated_at_utc: new Date(),
        },
      );
    }
  }
}
