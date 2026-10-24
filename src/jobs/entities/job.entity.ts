import { RenderJobAsset } from './jobAsset.entity';
import type { SkyMode } from '../assets';
import { bigintTransformer } from '../../accounting/bigint.transformer';
import { WorkerNode } from '../../nodes/entities/workerNode.entity';
import { User } from '../../users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RenderJobResourcePack } from './resourcePack.entity';
import { RenderTask, RenderTaskStatus } from './task.entity';

export enum RenderJobStatus {
  Draft = 'draft',
  Queued = 'queued',
  Running = 'running',
  MergePending = 'merge_pending',
  MergeRunning = 'merge_running',
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

  @Column({ type: 'datetime', nullable: true })
  expiresAt!: Date | null;

  @OneToMany(() => RenderTask, (task) => task.job)
  tasks!: RenderTask[];

  @ManyToOne(() => User, (task) => task.renderJobs, { nullable: false })
  user!: User;

  @Column({ nullable: true, default: null })
  hasEmitterGrid?: boolean;

  @Column({
    type: 'enum',
    enum: ['skybox', 'skymap'],
    nullable: true,
    default: null,
  })
  skyMode!: SkyMode;

  @OneToMany(() => RenderJobAsset, (assignment) => assignment.job, {
    cascade: true,
  })
  assets!: RenderJobAsset[];

  @Column({ default: false })
  createDump!: boolean;

  @Column({
    type: 'bigint',
    unsigned: true,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  minimumRam!: number;

  @OneToMany(() => RenderJobResourcePack, (match) => match.job, {
    cascade: true,
  })
  resourcePacks!: RenderJobResourcePack[];

  @ManyToOne(() => WorkerNode)
  assignedTo?: WorkerNode;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  workUnits!: bigint;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
    default: 0,
  })
  tipPerTask!: bigint;

  getProgress() {
    if (!this.tasks) {
      throw new Error('Tasks are required to calculate progress');
    }
    if (this.status === RenderJobStatus.Completed) {
      return 1;
    }
    if (this.tasks.length === 0) {
      return 0;
    }
    return (
      this.tasks.reduce(
        (total, task) =>
          total +
          (task.status === RenderTaskStatus.Completed
            ? 1
            : task.currentSpp / task.spp),
        0,
      ) / this.tasks.length
    );
  }
}
