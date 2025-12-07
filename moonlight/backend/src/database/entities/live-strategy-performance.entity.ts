import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('live_strategy_performance')
export class LiveStrategyPerformance {
  @PrimaryColumn()
  strategy_id: string;

  @Column('integer', { default: 0 })
  total_signals: number;

  @Column('integer', { default: 0 })
  executed_signals: number;

  @Column('integer', { default: 0 })
  wins: number;

  @Column('integer', { default: 0 })
  losses: number;

  @Column('real', { default: 0 })
  total_pnl: number;

  @Column('real', { default: 0 })
  avg_confidence: number;

  @Column('real', { default: 0 })
  win_rate: number;

  @Column('real', { default: 0 })
  avg_pnl_per_trade: number;

  @Column('integer', { default: 0 })
  consecutive_wins: number;

  @Column('integer', { default: 0 })
  consecutive_losses: number;

  @Column('integer', { default: 0 })
  max_consecutive_wins: number;

  @Column('integer', { default: 0 })
  max_consecutive_losses: number;

  @Column('boolean', { default: true })
  is_enabled: boolean;

  @Column({ nullable: true })
  last_signal_timestamp: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
