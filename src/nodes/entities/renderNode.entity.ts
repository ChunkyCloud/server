import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * A render node is a node that works on rendering jobs.
 * These are public and any user can create their own render nodes.
 */
@Entity()
export class RenderNode {
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

  @ManyToOne(() => User, (user) => user.renderNodes, { nullable: false })
  user!: User;
}
