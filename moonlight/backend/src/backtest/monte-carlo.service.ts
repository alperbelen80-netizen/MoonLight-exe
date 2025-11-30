import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { BacktestRun } from '../database/entities/backtest-run.entity';

export interface MonteCarloResult {
  run_id: string;
  simulations: number;
  confidence_level: number;
  expected_pnl: number;
  pnl_5th_percentile: number;
  pnl_95th_percentile: number;
  max_drawdown_distribution: number[];
  win_rate_distribution: number[];
}

@Injectable()
export class MonteCarloService {
  private readonly logger = new Logger(MonteCarloService.name);

  constructor(
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
    @InjectRepository(BacktestRun)
    private readonly backtestRunRepo: Repository<BacktestRun>,
  ) {}

  async runMonteCarloSimulation(
    runId: string,
    simulations: number = 1000,
  ): Promise<MonteCarloResult> {
    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      order: { entry_ts_utc: 'ASC' },
    });

    if (trades.length === 0) {
      throw new Error('No trades found for Monte Carlo simulation');
    }

    const pnls: number[] = [];
    const winRates: number[] = [];
    const maxDrawdowns: number[] = [];

    for (let sim = 0; sim < simulations; sim++) {
      const shuffledTrades = this.shuffleArray([...trades]);

      let equity = 1000;
      let maxEquity = 1000;
      let maxDD = 0;
      let wins = 0;

      shuffledTrades.forEach((trade) => {
        equity += trade.net_pnl;
        if (equity > maxEquity) maxEquity = equity;

        const dd = maxEquity - equity;
        if (dd > maxDD) maxDD = dd;

        if (trade.outcome === 'WIN') wins++;
      });

      pnls.push(equity - 1000);
      winRates.push(wins / trades.length);
      maxDrawdowns.push(maxDD);
    }

    pnls.sort((a, b) => a - b);

    const expectedPnl = pnls.reduce((sum, p) => sum + p, 0) / pnls.length;
    const pnl5th = pnls[Math.floor(simulations * 0.05)];
    const pnl95th = pnls[Math.floor(simulations * 0.95)];

    this.logger.log(
      `Monte Carlo simulation complete: ${simulations} sims, expected PnL: ${expectedPnl.toFixed(2)}`,
    );

    return {
      run_id: runId,
      simulations,
      confidence_level: 0.90,
      expected_pnl: expectedPnl,
      pnl_5th_percentile: pnl5th,
      pnl_95th_percentile: pnl95th,
      max_drawdown_distribution: maxDrawdowns.slice(0, 100),
      win_rate_distribution: winRates.slice(0, 100),
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
