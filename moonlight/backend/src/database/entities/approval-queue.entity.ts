import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('approval_queue')
export class ApprovalQueue {
  @PrimaryColumn()
  id: string;

  @Column()
  trade_uid: string;

  @Column()
  signal_id: string;

  @Column()
  account_id: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime', { nullable: true })
  decided_at_utc: Date;

  @Column({ nullable: true })
  decided_by: string;

  @Column('real')
  m3_uncertainty_score: number;

  @Column()
  m3_uncertainty_level: string;
}
