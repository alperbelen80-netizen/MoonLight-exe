import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('execution_config')
export class ExecutionConfig {
  @PrimaryColumn()
  id: string;

  @Column()
  mode: string;

  @Column('datetime')
  updated_at_utc: Date;
}
