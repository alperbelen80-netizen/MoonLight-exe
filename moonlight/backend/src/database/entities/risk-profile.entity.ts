import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('risk_profiles')
export class RiskProfile {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('real')
  max_per_trade_pct: number;

  @Column('real')
  max_daily_loss_pct: number;

  @Column('integer')
  max_concurrent_trades: number;

  @Column('real')
  max_exposure_per_symbol_pct: number;

  @Column('boolean', { default: true })
  enabled: boolean;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime')
  updated_at_utc: Date;
}
