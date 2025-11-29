import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('owner_accounts')
export class OwnerAccount {
  @PrimaryColumn()
  account_id: string;

  @Column()
  broker_id: string;

  @Column()
  alias: string;

  @Column()
  type: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: 'UP' })
  session_health: string;

  @Column('real', { nullable: true })
  balance: number;

  @Column('datetime')
  created_at_utc: Date;
}
