import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('backtest_trades')
export class BacktestTrade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  run_id: string;

  @Column()
  trade_uid: string;

  @Column()
  symbol: string;

  @Column()
  tf: string;

  @Column()
  strategy_id: string;

  @Column('datetime')
  entry_ts_utc: Date;

  @Column('datetime')
  exit_ts_utc: Date;

  @Column()
  direction: string;

  @Column('real')
  stake_amount: number;

  @Column('real')
  gross_pnl: number;

  @Column('real')
  net_pnl: number;

  @Column()
  outcome: string;

  @Column('real', { default: 0.85 })
  payout_ratio: number;

  @Column('real', { default: 0 })
  health_score: number;

  @Column({ nullable: true })
  rejim: string;

  @Column({ nullable: true })
  u_mode: string;
}
