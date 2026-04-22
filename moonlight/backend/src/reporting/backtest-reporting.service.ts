import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import {
  BacktestAdvancedReportDTO,
  BacktestMetricBreakdownItemDTO,
  EquityPointDTO,
} from '../shared/dto/backtest-report.dto';
import { BacktestRunSummaryDTO } from '../shared/dto/backtest.dto';

@Injectable()
export class BacktestReportingService {
  private readonly logger = new Logger(BacktestReportingService.name);

  constructor(
    @InjectRepository(BacktestRun)
    private readonly backtestRunRepo: Repository<BacktestRun>,
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
  ) {}

  async buildAdvancedReport(
    runId: string,
  ): Promise<BacktestAdvancedReportDTO> {
    const run = await this.backtestRunRepo.findOne({ where: { run_id: runId } });
    if (!run) {
      throw new Error(`Backtest run ${runId} not found`);
    }

    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      order: { entry_ts_utc: 'ASC' },
    });

    const summary: BacktestRunSummaryDTO = {
      run_id: run.run_id,
      status: run.status as any,
      symbols: JSON.parse(run.symbols),
      timeframes: JSON.parse(run.timeframes),
      strategy_ids: JSON.parse(run.strategy_ids),
      from_date: run.from_date,
      to_date: run.to_date,
      total_trades: run.total_trades,
      win_rate: run.win_rate,
      net_pnl: run.net_pnl,
      max_drawdown: run.max_drawdown,
      is_favorite: (run as any).is_favorite ?? false,
      environment: (run as any).environment ?? 'SANDBOX',
      hardware_profile: (run as any).hardware_profile ?? 'DEFAULT',
      created_at_utc: run.created_at_utc.toISOString(),
      updated_at_utc: run.updated_at_utc.toISOString(),
    };

    const sharpeRatio = this.calculateSharpeRatio(trades, run.initial_balance);
    const profitFactor = this.calculateProfitFactor(trades);
    const expectancyPerTrade = this.calculateExpectancy(trades);
    const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateStreaks(trades);

    const perSymbol = this.breakdownByDimension(trades, 'symbol');
    const perTimeframe = this.breakdownByDimension(trades, 'tf');
    const perStrategy = this.breakdownByDimension(trades, 'strategy_id');

    const equityCurve = this.buildEquityCurve(trades, run.initial_balance);

    return {
      run_id: runId,
      summary,
      sharpe_ratio: sharpeRatio,
      profit_factor: profitFactor,
      expectancy_per_trade: expectancyPerTrade,
      max_consecutive_wins: maxConsecutiveWins,
      max_consecutive_losses: maxConsecutiveLosses,
      per_symbol: perSymbol,
      per_timeframe: perTimeframe,
      per_strategy: perStrategy,
      equity_curve: equityCurve,
    };
  }

  private calculateSharpeRatio(trades: BacktestTrade[], initialBalance: number): number {
    if (trades.length === 0) return 0;

    const returns = trades.map((t) => t.net_pnl / initialBalance);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);

    if (std === 0) return 0;

    return mean / std;
  }

  private calculateProfitFactor(trades: BacktestTrade[]): number {
    const gains = trades.filter((t) => t.net_pnl > 0).reduce((sum, t) => sum + t.net_pnl, 0);
    const losses = Math.abs(trades.filter((t) => t.net_pnl < 0).reduce((sum, t) => sum + t.net_pnl, 0));

    if (losses === 0) return gains > 0 ? Infinity : 0;

    return gains / losses;
  }

  private calculateExpectancy(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;

    const winTrades = trades.filter((t) => t.outcome === 'WIN');
    const lossTrades = trades.filter((t) => t.outcome === 'LOSS');

    const winRate = winTrades.length / trades.length;
    const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.net_pnl, 0) / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.net_pnl, 0) / lossTrades.length : 0;

    return winRate * avgWin + (1 - winRate) * avgLoss;
  }

  private calculateStreaks(trades: BacktestTrade[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    trades.forEach((t) => {
      if (t.outcome === 'WIN') {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWins) {
          maxWins = currentWinStreak;
        }
      } else if (t.outcome === 'LOSS') {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLosses) {
          maxLosses = currentLossStreak;
        }
      }
    });

    return {
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
    };
  }

  private breakdownByDimension(
    trades: BacktestTrade[],
    dimension: 'symbol' | 'tf' | 'strategy_id',
  ): BacktestMetricBreakdownItemDTO[] {
    const groups = new Map<string, BacktestTrade[]>();

    trades.forEach((t) => {
      const key = t[dimension];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(t);
    });

    const breakdown: BacktestMetricBreakdownItemDTO[] = [];

    for (const [key, groupTrades] of groups) {
      const winCount = groupTrades.filter((t) => t.outcome === 'WIN').length;
      const winRate = groupTrades.length > 0 ? winCount / groupTrades.length : 0;
      const netPnl = groupTrades.reduce((sum, t) => sum + t.net_pnl, 0);
      const avgRoi = groupTrades.length > 0 ? netPnl / groupTrades.length : 0;

      breakdown.push({
        key,
        trades: groupTrades.length,
        win_rate: winRate,
        net_pnl: netPnl,
        avg_roi_per_trade: avgRoi,
      });
    }

    return breakdown.sort((a, b) => b.net_pnl - a.net_pnl);
  }

  private buildEquityCurve(trades: BacktestTrade[], initialBalance: number): EquityPointDTO[] {
    const curve: EquityPointDTO[] = [];
    let equity = initialBalance;

    curve.push({
      ts_utc: trades.length > 0 ? trades[0].entry_ts_utc.toISOString() : new Date().toISOString(),
      equity,
    });

    trades.forEach((t) => {
      equity += t.net_pnl;
      curve.push({
        ts_utc: t.exit_ts_utc.toISOString(),
        equity,
      });
    });

    return curve;
  }
}
