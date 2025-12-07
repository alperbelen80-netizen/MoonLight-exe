import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveStrategyPerformance } from '../database/entities/live-strategy-performance.entity';
import { LiveSignal } from '../database/entities/live-signal.entity';

export interface StrategyPerformanceDTO {
  strategyId: string;
  totalSignals: number;
  executedSignals: number;
  wins: number;
  losses: number;
  totalPnl: number;
  winRate: number;
  avgPnlPerTrade: number;
  avgConfidence: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  isEnabled: boolean;
  lastSignalTimestamp?: Date;
}

@Injectable()
export class LiveStrategyPerformanceService {
  private readonly logger = new Logger(LiveStrategyPerformanceService.name);

  constructor(
    @InjectRepository(LiveStrategyPerformance)
    private readonly performanceRepo: Repository<LiveStrategyPerformance>,
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
  ) {}

  async recordSignal(strategyId: string, confidence: number): Promise<void> {
    let perf = await this.performanceRepo.findOne({
      where: { strategy_id: strategyId },
    });

    if (!perf) {
      perf = this.performanceRepo.create({
        strategy_id: strategyId,
        total_signals: 0,
      });
    }

    perf.total_signals++;
    perf.last_signal_timestamp = new Date();

    const totalConf = perf.avg_confidence * (perf.total_signals - 1) + confidence;
    perf.avg_confidence = totalConf / perf.total_signals;

    await this.performanceRepo.save(perf);
  }

  async recordExecution(
    strategyId: string,
    outcome: 'WIN' | 'LOSS',
    pnl: number,
  ): Promise<void> {
    let perf = await this.performanceRepo.findOne({
      where: { strategy_id: strategyId },
    });

    if (!perf) {
      this.logger.warn(`Performance record not found for ${strategyId}`);
      return;
    }

    perf.executed_signals++;

    if (outcome === 'WIN') {
      perf.wins++;
      perf.consecutive_wins++;
      perf.consecutive_losses = 0;

      if (perf.consecutive_wins > perf.max_consecutive_wins) {
        perf.max_consecutive_wins = perf.consecutive_wins;
      }
    } else {
      perf.losses++;
      perf.consecutive_losses++;
      perf.consecutive_wins = 0;

      if (perf.consecutive_losses > perf.max_consecutive_losses) {
        perf.max_consecutive_losses = perf.consecutive_losses;
      }
    }

    perf.total_pnl += pnl;
    perf.win_rate = perf.executed_signals > 0 ? perf.wins / perf.executed_signals : 0;
    perf.avg_pnl_per_trade =
      perf.executed_signals > 0 ? perf.total_pnl / perf.executed_signals : 0;

    if (perf.consecutive_losses >= 5) {
      perf.is_enabled = false;
      this.logger.warn(
        `Strategy ${strategyId} AUTO-DISABLED: 5 consecutive losses`,
      );
    }

    await this.performanceRepo.save(perf);
  }

  async getAllPerformance(): Promise<StrategyPerformanceDTO[]> {
    const records = await this.performanceRepo.find({
      order: { win_rate: 'DESC' },
    });

    return records.map((r) => ({
      strategyId: r.strategy_id,
      totalSignals: r.total_signals,
      executedSignals: r.executed_signals,
      wins: r.wins,
      losses: r.losses,
      totalPnl: r.total_pnl,
      winRate: r.win_rate,
      avgPnlPerTrade: r.avg_pnl_per_trade,
      avgConfidence: r.avg_confidence,
      consecutiveWins: r.consecutive_wins,
      consecutiveLosses: r.consecutive_losses,
      maxConsecutiveWins: r.max_consecutive_wins,
      maxConsecutiveLosses: r.max_consecutive_losses,
      isEnabled: r.is_enabled,
      lastSignalTimestamp: r.last_signal_timestamp,
    }));
  }

  async enableStrategy(strategyId: string): Promise<void> {
    await this.performanceRepo.update(
      { strategy_id: strategyId },
      { is_enabled: true },
    );
    this.logger.log(`Strategy ${strategyId} ENABLED`);
  }

  async disableStrategy(strategyId: string): Promise<void> {
    await this.performanceRepo.update(
      { strategy_id: strategyId },
      { is_enabled: false },
    );
    this.logger.log(`Strategy ${strategyId} DISABLED`);
  }
}
