import { Injectable, Logger } from '@nestjs/common';
import { BacktestRunRequestDTO } from '../shared/dto/backtest.dto';
import { StrategyService } from '../strategy/strategy.service';
import { StrategyContext } from '../shared/dto/strategy-context.dto';
import { readOhlcvBarsBetweenDates } from '../shared/utils/parquet.util';
import { v4 as uuidv4 } from 'uuid';

export interface BacktestResult {
  total_trades: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  net_pnl: number;
  max_drawdown: number;
  trades: any[];
}

@Injectable()
export class ReplayRunnerService {
  private readonly logger = new Logger(ReplayRunnerService.name);
  private readonly baseDir = process.env.DATA_DIR || './data';

  constructor(private readonly strategyService: StrategyService) {}

  async runBacktest(params: {
    runId: string;
    request: BacktestRunRequestDTO;
  }): Promise<BacktestResult> {
    const { request } = params;
    const { symbols, timeframes, strategy_ids, from_date, to_date, initial_balance } = request;

    const allTrades: any[] = [];
    let equity = initial_balance;
    let maxEquity = initial_balance;
    let maxDrawdown = 0;

    for (const symbol of symbols) {
      for (const tf of timeframes) {
        this.logger.log(`Backtesting ${symbol} ${tf} from ${from_date} to ${to_date}`);

        const bars = await readOhlcvBarsBetweenDates({
          baseDir: this.baseDir,
          symbol,
          tf,
          fromDate: from_date,
          toDate: to_date,
        });

        if (bars.length < 20) {
          this.logger.warn(`Insufficient bars for ${symbol} ${tf}, skipping`);
          continue;
        }

        for (let i = 20; i < bars.length; i++) {
          const contextBars = bars.slice(Math.max(0, i - 100), i + 1);
          const currentBar = bars[i];

          const context: StrategyContext = {
            symbol,
            tf,
            now_ts_utc: currentBar.ts_utc,
            bars: contextBars,
            environment: request.environment,
          };

          const signals = await this.strategyService.evaluateStrategiesForContext({
            context,
            strategyIds: strategy_ids,
            options: { max_signals_per_context: 1 },
          });

          for (const signal of signals) {
            const expiryBarIndex = i + 1;
            if (expiryBarIndex >= bars.length) {
              continue;
            }

            const exitBar = bars[expiryBarIndex];
            const entryPrice = currentBar.close;
            const exitPrice = exitBar.close;

            let outcome: string;
            let grossPnl: number;

            const stakeAmount = 25;
            const payoutRatio = 0.85;

            if (signal.direction === 'CALL') {
              outcome = exitPrice > entryPrice ? 'WIN' : 'LOSS';
            } else {
              outcome = exitPrice < entryPrice ? 'WIN' : 'LOSS';
            }

            if (outcome === 'WIN') {
              grossPnl = stakeAmount * payoutRatio;
            } else {
              grossPnl = -stakeAmount;
            }

            const netPnl = grossPnl;

            equity += netPnl;
            if (equity > maxEquity) {
              maxEquity = equity;
            }

            const drawdown = maxEquity - equity;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }

            const trade = {
              trade_uid: `TRD_${uuidv4()}`,
              symbol,
              tf,
              strategy_id: signal.strategy_id || signal.source,
              entry_ts_utc: currentBar.ts_utc,
              exit_ts_utc: exitBar.ts_utc,
              direction: signal.direction,
              stake_amount: stakeAmount,
              gross_pnl: grossPnl,
              net_pnl: netPnl,
              outcome,
              payout_ratio: payoutRatio,
              health_score: outcome === 'WIN' ? 90 : 40,
            };

            allTrades.push(trade);
          }
        }
      }
    }

    const winCount = allTrades.filter((t) => t.outcome === 'WIN').length;
    const lossCount = allTrades.filter((t) => t.outcome === 'LOSS').length;
    const winRate = allTrades.length > 0 ? winCount / allTrades.length : 0;
    const netPnl = equity - initial_balance;

    this.logger.log(
      `Backtest complete: ${allTrades.length} trades, WR: ${(winRate * 100).toFixed(2)}%, Net PnL: $${netPnl.toFixed(2)}`,
    );

    return {
      total_trades: allTrades.length,
      win_count: winCount,
      loss_count: lossCount,
      win_rate: winRate,
      net_pnl: netPnl,
      max_drawdown: maxDrawdown,
      trades: allTrades,
    };
  }
}
