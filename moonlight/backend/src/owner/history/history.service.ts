import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BacktestTrade } from '../../database/entities/backtest-trade.entity';
import { PnlHistoryDTO, DailyPnlPoint } from '../../shared/dto/pnl-history.dto';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectRepository(BacktestTrade)
    private readonly backtestTradeRepo: Repository<BacktestTrade>,
  ) {}

  async getPnlHistory(params: {
    range: '7d' | '30d' | '90d';
    environment?: 'LIVE' | 'SANDBOX' | 'ALL';
  }): Promise<PnlHistoryDTO> {
    const { range, environment = 'ALL' } = params;

    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const queryBuilder = this.backtestTradeRepo
      .createQueryBuilder('trade')
      .where('trade.entry_ts_utc BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    const trades = await queryBuilder.getMany();

    const dailyMap = new Map<string, Map<string, DailyPnlPoint>>();

    trades.forEach((trade) => {
      const dateStr = trade.entry_ts_utc.toISOString().split('T')[0];
      const env = 'SANDBOX';

      if (environment !== 'ALL' && env !== environment) {
        return;
      }

      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, new Map());
      }

      const dayMap = dailyMap.get(dateStr)!;

      if (!dayMap.has(env)) {
        dayMap.set(env, {
          date: dateStr,
          environment: env as any,
          trades: 0,
          wins: 0,
          losses: 0,
          blocked_by_risk: 0,
          blocked_by_ev: 0,
          blocked_by_hw_profile: 0,
          net_pnl: 0,
        });
      }

      const point = dayMap.get(env)!;
      point.trades++;

      if (trade.outcome === 'WIN') {
        point.wins++;
      } else if (trade.outcome === 'LOSS') {
        point.losses++;
      }

      point.net_pnl += trade.net_pnl;
    });

    const points: DailyPnlPoint[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayMap = dailyMap.get(dateStr);

      if (dayMap) {
        points.push(...Array.from(dayMap.values()));
      } else {
        if (environment === 'ALL' || environment === 'LIVE') {
          points.push({
            date: dateStr,
            environment: 'LIVE',
            trades: 0,
            wins: 0,
            losses: 0,
            blocked_by_risk: 0,
            blocked_by_ev: 0,
            blocked_by_hw_profile: 0,
            net_pnl: 0,
          });
        }
        if (environment === 'ALL' || environment === 'SANDBOX') {
          points.push({
            date: dateStr,
            environment: 'SANDBOX',
            trades: 0,
            wins: 0,
            losses: 0,
            blocked_by_risk: 0,
            blocked_by_ev: 0,
            blocked_by_hw_profile: 0,
            net_pnl: 0,
          });
        }
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));

    this.logger.log(
      `PNL history generated: ${range}, env=${environment}, ${points.length} points`,
    );

    return {
      points,
      range,
      generated_at_utc: new Date().toISOString(),
    };
  }
}
