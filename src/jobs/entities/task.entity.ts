import { bigintTransformer } from '../../accounting/bigint.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RenderNode } from '../../nodes/entities/renderNode.entity';
import { RenderJob } from './job.entity';

export enum RenderTaskStatus {
  Queued = 'queued',
  Running = 'running',
  Uploading = 'uploading',
  Completed = 'completed',
  Aborted = 'aborted',
}

@Entity()
export class RenderTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  spp!: number;

  @Column({ type: 'int' })
  x!: number;

  @Column({ type: 'int' })
  y!: number;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({
    type: 'enum',
    enum: RenderTaskStatus,
    default: RenderTaskStatus.Queued,
  })
  status!: RenderTaskStatus;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  finishedAt?: Date;

  @Column({ nullable: true })
  abortedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => RenderJob, (user) => user.tasks, { nullable: false })
  job!: RenderJob;

  @ManyToOne(() => RenderNode)
  assignedTo?: RenderNode;

  @Column({ type: 'int', default: 0 })
  currentSpp!: number;

  @Column({ nullable: true })
  currentSppUpdatedAt?: Date;

  @Column({ nullable: true })
  @UpdateDateColumn()
  updatedAt?: Date;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  workUnits!: bigint;
}
