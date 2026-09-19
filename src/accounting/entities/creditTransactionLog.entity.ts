import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CreditTransactionType } from '../creditTransaction';

@Entity()
@Index(['userId', 'createdAt'])
export class CreditTransactionLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

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

  // no foreign keys; keep historical references even after jobs or tasks are deleted
  @Column({ type: 'int', nullable: true })
  jobId!: number | null;

  @Column({ type: 'int', nullable: true })
  taskId!: number | null;

  @Column({ type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
