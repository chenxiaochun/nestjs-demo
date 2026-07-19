import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type JobType = 'cron' | 'every' | 'at';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  instruction!: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'cron',
  })
  type!: JobType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  corn!: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  everyMs!: number;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  at!: Date | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  isEnabled!: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastRun!: Date | null;

  @Column({
    type: 'timestamp',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  updatedAt!: Date | null;
}
