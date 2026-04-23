// MoonLight V2.3-B — Persistent scheduler tick history.
// Stored as SQLite rows; auto-synchronize covers migrations (DB_SYNCHRONIZE=true).

import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('learning_tick_history')
@Index('idx_ltick_at', ['at_utc'])
export class LearningTickHistory {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  at_utc: string; // ISO 8601

  @Column('integer')
  ran: number; // SQLite-friendly boolean (0 / 1)

  @Column('text')
  reason: string;

  @Column('integer', { nullable: true })
  brains: number | null;

  @Column('real', { nullable: true })
  avgHealth: number | null;

  @CreateDateColumn()
  created_at: Date;
}
