import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('reconciliation_runs')
export class ReconciliationRun {
  @PrimaryColumn()
  id: string;

  @Column()
  account_id: string;

  @Column()
  status: string;

  @Column('integer', { default: 0 })
  mismatch_count: number;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime', { nullable: true })
  completed_at_utc: Date;
}
