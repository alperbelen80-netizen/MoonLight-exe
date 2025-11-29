import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  OwnerDashboardSummaryDTO,
  OwnerBacktestRunItemDTO,
  OwnerTopStrategyItemDTO,
  QueueHealthDTO,
} from '../../shared/dto/owner-dashboard.dto';
import { BacktestRun } from '../../database/entities/backtest-run.entity';
import { BacktestTrade } from '../../database/entities/backtest-trade.entity';
import { BacktestRunStatus } from '../../shared/dto/backtest.dto';

@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);

  constructor(
    @InjectRepository(BacktestRun)
    private readonly backtestRunRepo: Repository<BacktestRun>,
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
    @InjectQueue('backtest')
    private readonly backtestQueue: Queue,
  ) {}

  async getDashboardSummary(): Promise<OwnerDashboardSummaryDTO> {
    const allRuns = await this.backtestRunRepo.find();

    const countsByStatus: Record<BacktestRunStatus, number> = {
      [BacktestRunStatus.QUEUED]: 0,
      [BacktestRunStatus.RUNNING]: 0,
      [BacktestRunStatus.COMPLETED]: 0,
      [BacktestRunStatus.FAILED]: 0,
    };

    allRuns.forEach((run) => {
      const status = run.status as BacktestRunStatus;
      if (countsByStatus[status] !== undefined) {
        countsByStatus[status]++;
      }
    });

    const recentRuns = await this.backtestRunRepo.find({
      order: { created_at_utc: 'DESC' },
      take: 20,
    });

    const recentRunItems: OwnerBacktestRunItemDTO[] = recentRuns.map((run) => ({
      run_id: run.run_id,
      status: run.status as BacktestRunStatus,
      symbols: JSON.parse(run.symbols),
      timeframes: JSON.parse(run.timeframes),
      strategy_ids: JSON.parse(run.strategy_ids),
      from_date: run.from_date,
      to_date: run.to_date,
      net_pnl: run.net_pnl,
      win_rate: run.win_rate,
      created_at_utc: run.created_at_utc.toISOString(),
    }));

    const completedRunIds = allRuns
      .filter((r) => r.status === BacktestRunStatus.COMPLETED)
      .map((r) => r.run_id);

    const topStrategies = await this.calculateTopStrategies(completedRunIds);

    const queueCounts = await this.backtestQueue.getJobCounts();
    const queueHealth: QueueHealthDTO[] = [
      {
        queue_name: 'backtest',
        waiting: queueCounts.waiting || 0,
        active: queueCounts.active || 0,
        completed: queueCounts.completed || 0,
        failed: queueCounts.failed || 0,
        delayed: queueCounts.delayed || 0,
      },
    ];

    return {
      backtest_counts_by_status: countsByStatus,
      recent_runs: recentRunItems,
      top_strategies: topStrategies,
      queue_health: queueHealth,
      generated_at_utc: new Date().toISOString(),
    };
  }

  private async calculateTopStrategies(
    runIds: string[],
  ): Promise<OwnerTopStrategyItemDTO[]> {
    if (runIds.length === 0) {
      return [];
    }

    const trades = await this.backtestTradeRepo
      .createQueryBuilder('trade')
      .where('trade.run_id IN (:...runIds)', { runIds })
      .getMany();

    const byStrategy = new Map<string, BacktestTrade[]>();

    trades.forEach((t) => {
      if (!byStrategy.has(t.strategy_id)) {
        byStrategy.set(t.strategy_id, []);
      }
      byStrategy.get(t.strategy_id)!.push(t);
    });

    const topList: OwnerTopStrategyItemDTO[] = [];

    for (const [strategyId, stratTrades] of byStrategy) {
      const winCount = stratTrades.filter((t) => t.outcome === 'WIN').length;
      const winRate = stratTrades.length > 0 ? winCount / stratTrades.length : 0;
      const netPnl = stratTrades.reduce((sum, t) => sum + t.net_pnl, 0);

      topList.push({
        strategy_id: strategyId,
        total_trades: stratTrades.length,
        win_rate: winRate,
        net_pnl: netPnl,
      });
    }

    return topList.sort((a, b) => b.net_pnl - a.net_pnl).slice(0, 10);
  }
}
