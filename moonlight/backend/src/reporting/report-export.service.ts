import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { BacktestReportingService } from './backtest-reporting.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);

  constructor(
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
    private readonly backtestReportingService: BacktestReportingService,
  ) {}

  async exportBacktestToCsv(
    runId: string,
  ): Promise<{ filename: string; content: string }> {
    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      order: { entry_ts_utc: 'ASC' },
    });

    const header =
      'trade_uid,symbol,tf,strategy_id,entry_ts_utc,exit_ts_utc,direction,stake_amount,net_pnl,outcome,payout_ratio';

    const rows = trades.map((t) =>
      [
        t.trade_uid,
        t.symbol,
        t.tf,
        t.strategy_id,
        t.entry_ts_utc.toISOString(),
        t.exit_ts_utc.toISOString(),
        t.direction,
        t.stake_amount,
        t.net_pnl.toFixed(2),
        t.outcome,
        t.payout_ratio.toFixed(2),
      ].join(','),
    );

    const content = [header, ...rows].join('\n');
    const filename = `backtest_${runId}.csv`;

    this.logger.log(`Exported CSV: ${filename} (${trades.length} trades)`);

    return { filename, content };
  }

  async exportBacktestToXlsx(
    runId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.backtestReportingService.buildAdvancedReport(runId);

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('SUMMARY');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Run ID', value: report.run_id },
      { metric: 'Status', value: report.summary.status },
      { metric: 'Symbols', value: report.summary.symbols.join(', ') },
      { metric: 'Timeframes', value: report.summary.timeframes.join(', ') },
      { metric: 'Total Trades', value: report.summary.total_trades },
      { metric: 'Win Rate (%)', value: (report.summary.win_rate * 100).toFixed(2) },
      { metric: 'Net PnL', value: report.summary.net_pnl.toFixed(2) },
      { metric: 'Max Drawdown', value: report.summary.max_drawdown.toFixed(2) },
      { metric: 'Sharpe Ratio', value: report.sharpe_ratio.toFixed(4) },
      { metric: 'Profit Factor', value: report.profit_factor.toFixed(2) },
      { metric: 'Expectancy/Trade', value: report.expectancy_per_trade.toFixed(2) },
      { metric: 'Max Consecutive Wins', value: report.max_consecutive_wins },
      { metric: 'Max Consecutive Losses', value: report.max_consecutive_losses },
    ]);

    const trades = await this.backtestTradeRepo.find({
      where: { run_id: runId },
      order: { entry_ts_utc: 'ASC' },
    });

    const tradesSheet = workbook.addWorksheet('TRADES');
    tradesSheet.columns = [
      { header: 'Trade UID', key: 'trade_uid', width: 20 },
      { header: 'Symbol', key: 'symbol', width: 12 },
      { header: 'TF', key: 'tf', width: 8 },
      { header: 'Strategy', key: 'strategy_id', width: 20 },
      { header: 'Entry Time', key: 'entry_ts_utc', width: 22 },
      { header: 'Exit Time', key: 'exit_ts_utc', width: 22 },
      { header: 'Direction', key: 'direction', width: 10 },
      { header: 'Stake', key: 'stake_amount', width: 12 },
      { header: 'Net PnL', key: 'net_pnl', width: 12 },
      { header: 'Outcome', key: 'outcome', width: 10 },
      { header: 'Payout Ratio', key: 'payout_ratio', width: 12 },
    ];

    trades.forEach((t) => {
      tradesSheet.addRow({
        trade_uid: t.trade_uid,
        symbol: t.symbol,
        tf: t.tf,
        strategy_id: t.strategy_id,
        entry_ts_utc: t.entry_ts_utc.toISOString(),
        exit_ts_utc: t.exit_ts_utc.toISOString(),
        direction: t.direction,
        stake_amount: t.stake_amount,
        net_pnl: t.net_pnl,
        outcome: t.outcome,
        payout_ratio: t.payout_ratio,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `backtest_${runId}.xlsx`;

    this.logger.log(
      `Exported XLSX: ${filename} (${trades.length} trades, 2 sheets)`,
    );

    return { filename, buffer: Buffer.from(buffer) };
  }
}
