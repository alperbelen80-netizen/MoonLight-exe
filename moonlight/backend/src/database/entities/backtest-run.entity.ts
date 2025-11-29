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

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime')
  updated_at_utc: Date;
}
