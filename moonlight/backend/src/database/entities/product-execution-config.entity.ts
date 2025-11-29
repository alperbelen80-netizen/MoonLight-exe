import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('product_execution_config')
export class ProductExecutionConfig {
  @PrimaryColumn()
  id: string;

  @Column()
  symbol: string;

  @Column()
  tf: string;

  @Column('boolean', { default: true })
  data_enabled: boolean;

  @Column('boolean', { default: true })
  signal_enabled: boolean;

  @Column('boolean', { default: true })
  auto_trade_enabled: boolean;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime')
  updated_at_utc: Date;
}
