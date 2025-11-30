import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('backtest_runs')
export class BacktestRun {
  @PrimaryColumn()
  run_id: string;

  @Column()
  status: string;

  @Column('text')
  symbols: string;

  @Column('text')
  timeframes: string;

  @Column('text')
  strategy_ids: string;

  @Column()
  from_date: string;

  @Column()
  to_date: string;

  @Column('real')
  initial_balance: number;

  @Column('real', { default: 0 })
  net_pnl: number;

  @Column('real', { default: 0 })
  win_rate: number;

  @Column('real', { default: 0 })
  max_drawdown: number;

  @Column('integer', { default: 0 })
  total_trades: number;

  @Column('integer', { default: 0 })
  blocked_by_risk_count: number;

  @Column('integer', { default: 0 })
  cancelled_trades_count: number;

  @Column('real', { nullable: true })
  sharpe: number;

  @Column('real', { nullable: true })
  profit_factor: number;

  @Column('real', { nullable: true })
  expectancy: number;

  @Column('text', { nullable: true })
  tags: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: false })
  is_favorite: boolean;

  @Column({ default: 'SANDBOX' })
  environment: string;

  @Column({ default: 'SAFE' })
  hardware_profile: string;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime')
  updated_at_utc: Date;

  @Column('datetime', { nullable: true })
  completed_at_utc: Date;
}
