import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('circuit_breaker_events')
export class CircuitBreakerEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  level: string;

  @Column()
  scope: string;

  @Column('text')
  affected_ids: string;

  @Column('text')
  reason: string;

  @Column('datetime')
  triggered_at_utc: Date;

  @Column({ default: 'SYSTEM' })
  triggered_by: string;

  @Column({ nullable: true })
  cooldown_until_utc: Date;
}
