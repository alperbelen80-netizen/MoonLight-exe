import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('live_signals')
export class LiveSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp_utc: Date;

  @Column()
  symbol: string;

  @Column()
  timeframe: string;

  @Column()
  direction: string;

  @Column('integer')
  signal_horizon: number;

  @Column()
  strategy_family: string;

  @Column('real')
  confidence_score: number;

  @Column('real', { nullable: true })
  expected_wr_band_min: number;

  @Column('real', { nullable: true })
  expected_wr_band_max: number;

  @Column({ default: 'LIVE_DATA' })
  environment: string;

  @Column({ default: 'NEW' })
  status: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('real', { nullable: true })
  entry_price: number;

  @Column('real', { nullable: true })
  current_price: number;
}
