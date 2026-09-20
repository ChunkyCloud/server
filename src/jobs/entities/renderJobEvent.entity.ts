import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RenderJob } from './job.entity';
import { RenderTask } from './task.entity';
import { RenderNode } from '../../nodes/entities/renderNode.entity';
import { WorkerNode } from '../../nodes/entities/workerNode.entity';

export enum RenderJobEventType {
  TaskAssigned = 'task_assigned',
  TaskStarted = 'task_started',
  TaskCompleted = 'task_completed',
  TaskRequeued = 'task_requeued',
  TaskFailed = 'task_failed',
  JobQueued = 'job_queued',
  JobCompleted = 'job_completed',
  JobCancelled = 'job_cancelled',
}

export enum RenderJobEventVisibility {
  User = 'user',
  Admin = 'admin',
}

export interface RenderJobEventReason {
  code: string;
  message?: string;
}

@Entity()
@Index(['job', 'createdAt', 'id'])
@Index(['job', 'visibility', 'createdAt', 'id'])
export class RenderJobEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => RenderJob, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  job!: RenderJob;

  @Column({ type: 'enum', enum: RenderJobEventType })
  type!: RenderJobEventType;

  @Column({ type: 'enum', enum: RenderJobEventVisibility })
  visibility!: RenderJobEventVisibility;

  @ManyToOne(() => RenderTask, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  task!: RenderTask | null;

  @ManyToOne(() => RenderNode, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  renderNode!: RenderNode | null;

  @ManyToOne(() => WorkerNode, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  workerNode!: WorkerNode | null;

  @Column({ type: 'json', nullable: true })
  reason!: RenderJobEventReason | null;

  @CreateDateColumn()
  createdAt!: Date;
}
