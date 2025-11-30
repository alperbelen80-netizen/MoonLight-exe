import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';

export interface WalkForwardResult {
  run_id: string;
  windows: number;
  in_sample_wr: number;
  out_sample_wr: number;
  degradation: number;
  is_robust: boolean;
  window_results: Array<{
    window: number;
    in_sample_trades: number;
    out_sample_trades: number;
    in_sample_wr: number;
    out_sample_wr: number;
  }>;
}

@Injectable()
export class WalkForwardService {
  private readonly logger = new Logger(WalkForwardService.name);

  constructor(
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
  ) {}

  async analyzeWalkForward(
    runId: string,
    windowSize: number = 100,
  ): Promise<WalkForwardResult> {
    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      order: { entry_ts_utc: 'ASC' },
    });

    if (trades.length < windowSize * 2) {
      throw new Error('Insufficient trades for walk-forward analysis');
    }

    const windowResults = [];
    let totalInSampleWR = 0;
    let totalOutSampleWR = 0;
    let windowCount = 0;

    for (let i = 0; i < trades.length - windowSize * 2; i += windowSize) {
      const inSampleTrades = trades.slice(i, i + windowSize);
      const outSampleTrades = trades.slice(i + windowSize, i + windowSize * 2);

      const inSampleWins = inSampleTrades.filter((t) => t.outcome === 'WIN').length;
      const outSampleWins = outSampleTrades.filter((t) => t.outcome === 'WIN').length;

      const inSampleWR = inSampleWins / inSampleTrades.length;
      const outSampleWR = outSampleWins / outSampleTrades.length;

      totalInSampleWR += inSampleWR;
      totalOutSampleWR += outSampleWR;
      windowCount++;

      windowResults.push({
        window: windowCount,
        in_sample_trades: inSampleTrades.length,
        out_sample_trades: outSampleTrades.length,
        in_sample_wr: inSampleWR,
        out_sample_wr: outSampleWR,
      });
    }

    const avgInSampleWR = totalInSampleWR / windowCount;
    const avgOutSampleWR = totalOutSampleWR / windowCount;
    const degradation = avgInSampleWR - avgOutSampleWR;
    const isRobust = degradation < 0.05;

    this.logger.log(
      `Walk-forward analysis: ${windowCount} windows, degradation: ${(degradation * 100).toFixed(2)}%, robust: ${isRobust}`,
    );

    return {
      run_id: runId,
      windows: windowCount,
      in_sample_wr: avgInSampleWR,
      out_sample_wr: avgOutSampleWR,
      degradation,
      is_robust: isRobust,
      window_results: windowResults,
    };
  }
}
