import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('config_snapshots')
export class ConfigSnapshot {
  @PrimaryColumn()
  id: string;

  @Column()
  scope: string;

  @Column()
  ref_id: string;

  @Column()
  label: string;

  @Column('text')
  payload_json: string;

  @Column('datetime')
  created_at_utc: Date;

  @Column()
  created_by: string;
}
