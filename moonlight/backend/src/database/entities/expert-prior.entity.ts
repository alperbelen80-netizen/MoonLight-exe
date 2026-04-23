// MoonLight V2.4-A — ExpertPrior persistent weights.
// One row per (brain, expert_role). Upserted each closed-loop step.

import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('expert_prior')
@Index('idx_prior_brain', ['brain'])
export class ExpertPrior {
  @PrimaryColumn('text')
  id: string; // format: `${brain}__${role}`

  @Column('text')
  brain: string; // BrainType as string

  @Column('text')
  role: string; // ExpertRole as string

  @Column('real')
  weight: number;

  @Column('text')
  updated_at_utc: string;
}
