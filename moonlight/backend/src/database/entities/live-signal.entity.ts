import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('live_signals')
@Index('idx_live_signals_symbol_ts', ['symbol', 'timestamp_utc'])
@Index('idx_live_signals_verdict', ['ai_verdict'])
@Index('idx_live_signals_strategy_ts', ['strategy_family', 'timestamp_utc'])
@Index('idx_live_signals_status', ['status'])
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

  // ---- AI Reasoning Layer (v1.8) ----
  @Column({ nullable: true, default: 'UNKNOWN' })
  ai_verdict: string; // APPROVED | REJECTED | UNKNOWN | PENDING

  @Column('real', { nullable: true })
  ai_confidence: number;

  @Column('text', { nullable: true })
  ai_reasoning: string;

  @Column({ nullable: true })
  ai_reasoned_at_utc: Date;
}
