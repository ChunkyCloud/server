import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Worker nodes are internal to the service. They do tasks like merging tiles
 * and can't be created by users.
 */
@Entity()
export class WorkerNode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  name?: string;

  @Column({ select: false })
  tokenHash!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ nullable: true })
  lastSeenAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
