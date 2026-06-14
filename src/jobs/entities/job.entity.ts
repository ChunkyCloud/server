import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RenderTask } from './task.entity';

export enum RenderJobStatus {
  Draft = 'draft',
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Aborted = 'aborted',
}

@Entity()
export class RenderJob {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  spp!: number;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({
    type: 'enum',
    enum: RenderJobStatus,
    default: RenderJobStatus.Draft,
  })
  status!: RenderJobStatus;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  finishedAt?: Date;

  @Column({ nullable: true })
  abortedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => RenderTask, (task) => task.job)
  tasks!: RenderTask[];

  @ManyToOne(() => User, (task) => task.renderJobs, { nullable: false })
  user!: User;

  @Column({ nullable: true, default: null })
  hasEmitterGrid?: boolean;

  @Column({ default: false })
  createDump!: boolean;
}
