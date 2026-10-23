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

  @Column({ type: String, nullable: true })
  version?: string | null;

  @Column({ type: 'int', nullable: true })
  versionCode?: number | null;

  @Column({ type: 'float', default: 0 })
  currentSps!: number;

  @Column({ nullable: true })
  currentSpsUpdatedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.renderNodes, { nullable: false })
  user!: User;
}
