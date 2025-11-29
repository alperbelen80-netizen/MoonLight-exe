import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  alert_id: string;

  @Column()
  source: string;

  @Column()
  severity: string;

  @Column()
  category: string;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  details: string;

  @Column({ default: 'OPEN' })
  status: string;

  @Column({ nullable: true })
  auto_action: string;

  @Column({ nullable: true })
  owner_action: string;

  @Column('datetime')
  created_at_utc: Date;

  @Column('datetime', { nullable: true })
  resolved_at_utc: Date;

  @Column({ nullable: true })
  runbook_link: string;
}
