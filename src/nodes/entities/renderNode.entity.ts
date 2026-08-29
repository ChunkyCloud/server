import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

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
