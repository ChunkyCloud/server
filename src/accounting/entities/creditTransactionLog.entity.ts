import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditTransactionType } from '../creditTransaction';
import { User } from '../../users/entities/user.entity';
import { RenderJob } from '../../jobs/entities/job.entity';
import { RenderTask } from '../../jobs/entities/task.entity';

@Entity()
@Index(['user', 'createdAt'])
export class CreditTransactionLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  user!: User;

  // charges are negative, rewards are positive
  @Column({
    type: 'bigint',
    transformer: {
      to: (value: bigint) => value.toString(),
      from: (value: string | number) => BigInt(value),
    },
  })
  amount!: bigint;

  @Column({ type: 'enum', enum: CreditTransactionType })
  type!: CreditTransactionType;

  // Retain referenced records for soft deletes; never cascade historical entries.
  @ManyToOne(() => RenderJob, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  job!: RenderJob | null;

  @ManyToOne(() => RenderTask, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  task!: RenderTask | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
