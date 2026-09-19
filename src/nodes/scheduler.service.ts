import { ConflictException, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull } from 'typeorm';
import {
  AccountingService,
  CreditTransactionType,
} from '../accounting/accounting.service';
import { RenderJob, RenderJobStatus } from '../jobs/entities/job.entity';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';
import {
  JobMergeStartedEvent,
  JobsBus,
  RenderTasksAvailableEvent,
} from '../jobs/jobs.bus';
import { StorageService } from '../storage/storage.service';
import { RenderNode } from './entities/renderNode.entity';
import { WorkerNode } from './entities/workerNode.entity';

export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly storageService: StorageService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jobsBus: JobsBus,
    private readonly accounting: AccountingService,
  ) {}

  async getAssetUrl(
    jobId: number,
    file: 'scene' | 'octree' | 'emittergrid',
  ): Promise<string> {
    const url = await this.storageService.getDownloadUrl(
      `jobs/${jobId}/assets/${{ scene: 'scene.json', octree: 'scene.octree2', emittergrid: 'scene.emittergrid' }[file]}`,
      60 * 60, // 1 hour
      12 * 60 * 60, // 12 hours
    );
    if (!url) {
      throw new Error(`Could not get asset url for job ${jobId} asset ${file}`);
    }
    return url;
  }

  async getRenderTaskResultUploadUrls(taskId: number) {
    const task = await this.dataSource
      .getRepository(RenderTask)
      .findOneOrFail({ where: { id: taskId }, relations: { job: true } });
    return {
      image: await this.storageService.getUploadUrl(
        `jobs/${task.job.id}/results/${taskId}/tile.png`,
        60 * 60,
      ),
      dump: task.job.createDump
        ? await this.storageService.getUploadUrl(
            `jobs/${task.job.id}/results/${taskId}/tile.dump`,
            60 * 60,
          )
        : undefined,
    };
  }

  async hasRenderTaskResultsFiles(taskId: number) {
    const task = await this.dataSource
      .getRepository(RenderTask)
      .findOneOrFail({ where: { id: taskId }, relations: { job: true } });
    if (
      !(await this.storageService.checkKeyExists(
        `jobs/${task.job.id}/results/${taskId}/tile.png`,
      ))
    ) {
      return false;
    }
    if (
      task.job.createDump &&
      !(await this.storageService.checkKeyExists(
        `jobs/${task.job.id}/results/${taskId}/tile.dump`,
      ))
    ) {
      return false;
    }
    return true;
  }

  async getNextRenderTask(renderNode: RenderNode): Promise<RenderTask | null> {
    // try to resume previously assigned task
    const resumed = await this.dataSource.getRepository(RenderTask).findOne({
      where: {
        assignedTo: { id: renderNode.id },
        status: In([RenderTaskStatus.Running, RenderTaskStatus.Uploading]),
      },
      relations: { job: { resourcePacks: { resourcePack: true } } },
      order: { job: { resourcePacks: { orderIndex: 'asc' } } },
    });
    if (resumed) {
      if (resumed.status !== RenderTaskStatus.Running) {
        await this.dataSource.getRepository(RenderTask).update(resumed.id, {
          status: RenderTaskStatus.Running,
        });
      }
      const startedAt = new Date();
      if (!resumed.job.startedAt) {
        await this.dataSource.getRepository(RenderJob).update(
          {
            id: resumed.job.id,
            startedAt: IsNull(),
          },
          {
            startedAt,
          },
        );
      }
      await this.dataSource
        .getRepository(RenderJob)
        .update(
          { id: resumed.job.id, status: RenderJobStatus.Queued },
          { status: RenderJobStatus.Running },
        );
      return resumed;
    }

    // claim new task
    const result = await this.dataSource
      .createQueryBuilder()
      .update(RenderTask)
      .set({
        status: RenderTaskStatus.Running,
        assignedTo: { id: renderNode.id },
        startedAt: new Date(),
      })
      .where({
        status: RenderTaskStatus.Queued,
      })
      .limit(1)
      .execute();
    if (result.affected === 1) {
      return this.getNextRenderTask(renderNode);
    }

    return null;
  }

  async markRenderTaskAsUploading(
    taskId: number,
    renderNode: RenderNode,
  ): Promise<boolean> {
    const result = await this.dataSource.getRepository(RenderTask).update(
      {
        id: taskId,
        assignedTo: { id: renderNode.id },
        status: In([RenderTaskStatus.Running, RenderTaskStatus.Uploading]),
      },
      {
        status: RenderTaskStatus.Uploading,
        currentSpp: () => 'spp',
      },
    );
    return result.affected === 1;
  }

  async markRenderTaskAsCompleted(
    taskId: number,
    renderNode: RenderNode,
  ): Promise<boolean> {
    if (!(await this.hasRenderTaskResultsFiles(taskId))) {
      throw new ConflictException('Missing result files');
    }

    return this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(RenderTask).update(
        {
          id: taskId,
          assignedTo: { id: renderNode.id },
          status: RenderTaskStatus.Uploading,
        },
        {
          status: RenderTaskStatus.Completed,
          finishedAt: new Date(),
        },
      );
      if (result.affected !== 1) {
        return false;
      }

      const { job: jobId, workUnits }: { job: number; workUnits: bigint } =
        (await manager.getRepository(RenderTask).findOneOrFail({
          select: { job: { id: true }, workUnits: true },
          where: { id: taskId },
          loadRelationIds: { relations: ['job'] },
        })) as unknown as { job: number; workUnits: bigint };

      // give credits to user the render node belongs to
      await this.accounting.reward(manager, renderNode.user.id, {
        amount: workUnits,
        type: CreditTransactionType.RenderReward,
        taskId,
        jobId,
      });

      // mark queued/running job as merge pending if all tasks are completed
      const markMergePendingResult = await manager
        .createQueryBuilder()
        .update(RenderJob)
        .set({
          status: RenderJobStatus.MergePending,
        })
        .where('id = :jobId', { jobId })
        .andWhere('status IN (:...statuses)', {
          statuses: [RenderJobStatus.Queued, RenderJobStatus.Running],
        })
        .andWhere(
          `NOT EXISTS (
            SELECT 1
            FROM render_task task
            WHERE task.jobId = :jobId
              AND task.status <> :completedStatus
          )`,
          {
            jobId,
            completedStatus: RenderTaskStatus.Completed,
          },
        )
        .execute();
      if (markMergePendingResult.affected === 1) {
        this.jobsBus.publish(new JobMergeStartedEvent(jobId));
      }

      // mark running (but uncompleted) job as queued if no tasks are running
      await manager
        .createQueryBuilder()
        .update(RenderJob)
        .set({
          status: RenderJobStatus.Queued,
        })
        .where('id = :jobId', { jobId })
        .andWhere('status = :status', {
          status: RenderJobStatus.Running,
        })
        .andWhere(
          `NOT EXISTS (
            SELECT 1
            FROM render_task task
            WHERE task.jobId = :jobId
              AND task.status IN (:...runningStatuses)
          )`,
          {
            jobId,
            runningStatuses: [
              RenderTaskStatus.Running,
              RenderTaskStatus.Uploading,
            ],
          },
        )
        .execute();
      return true;
    });
  }

  async setRenderTaskProgress(
    taskId: number,
    renderNode: RenderNode,
    spp: number,
  ): Promise<boolean> {
    const result = await this.dataSource.getRepository(RenderTask).update(
      {
        id: taskId,
        assignedTo: { id: renderNode.id },
        status: In([RenderTaskStatus.Queued, RenderTaskStatus.Running]),
      },
      {
        status: RenderTaskStatus.Running,
        currentSpp: spp,
        currentSppUpdatedAt: new Date(),
      },
    );
    return result.affected === 1;
  }

  async unassignTasksOfRenderNode(renderNode: RenderNode) {
    const updateTasksResult = await this.dataSource
      .getRepository(RenderTask)
      .update(
        {
          status: In([
            RenderTaskStatus.Queued,
            RenderTaskStatus.Running,
            RenderTaskStatus.Uploading,
          ]),
          assignedTo: { id: renderNode.id },
        },
        { status: RenderTaskStatus.Queued, assignedTo: null! },
      );
    // TODO mark job as queued if no task is running now
    if ((updateTasksResult.affected ?? 0) > 0) {
      this.jobsBus.publish(new RenderTasksAvailableEvent());
    }
  }

  @Interval(5 * 60 * 1000)
  async unassignStuckRenderTasks() {
    {
      // Re-queue render tasks that are assigned to a node that is offline
      const updateTasksResult = await this.dataSource
        .createQueryBuilder()
        .update(RenderTask)
        .set({
          status: RenderTaskStatus.Queued,
          assignedTo: null!,
        })
        .where('status in (:...runningStatuses)', {
          runningStatuses: [
            RenderTaskStatus.Running,
            RenderTaskStatus.Uploading,
          ],
        })
        .andWhere('assignedToId IS NOT NULL')
        .andWhere(
          '(SELECT lastSeenAt FROM render_node rn WHERE rn.id = render_task.assignedToId) < :staleBefore',
          { staleBefore: new Date(Date.now() - 5 * 60 * 1000) },
        )
        .execute();
      // TODO mark job as queued if no task is running now
      if ((updateTasksResult.affected ?? 0) > 0) {
        this.logger.log(
          `Unassigned ${updateTasksResult.affected} render tasks that were assigned to offline nodes`,
        );
        this.jobsBus.publish(new RenderTasksAvailableEvent());
      }
    }

    {
      // Re-queue render tasks that are stuck uploading (i.e. uploading for more than 15 minutes)
      const stuckTasksResult = await this.dataSource
        .createQueryBuilder()
        .update(RenderTask)
        .set({
          status: RenderTaskStatus.Queued,
          assignedTo: null!,
        })
        .where('status = :status', {
          status: RenderTaskStatus.Uploading,
        })
        .andWhere('updatedAt IS NOT NULL')
        .andWhere('updatedAt < :staleBefore', {
          staleBefore: new Date(Date.now() - 15 * 60 * 1000),
        })
        .execute();
      if ((stuckTasksResult.affected ?? 0) > 0) {
        this.logger.log(
          `Unassigned ${stuckTasksResult.affected} render tasks that were stuck uploading`,
        );
        this.jobsBus.publish(new RenderTasksAvailableEvent());
      }
    }
  }

  async getNextWorkerTask(workerNode: WorkerNode): Promise<WorkerTask | null> {
    // try to resume previously assigned task
    const resumed = await this.dataSource.getRepository(RenderJob).findOne({
      where: {
        assignedTo: { id: workerNode.id },
        status: RenderJobStatus.MergeRunning,
      },
      relations: { tasks: true },
    });
    if (resumed) {
      return {
        type: 'merge',
        job: {
          id: resumed.id,
          width: resumed.width,
          height: resumed.height,
        },
        tiles: await Promise.all(
          resumed.tasks.map(async (task) => ({
            x: task.x,
            y: task.y,
            width: task.width,
            height: task.height,
            image: {
              url: await this.storageService.getDownloadUrl(
                `jobs/${resumed.id}/results/${task.id}/tile.png`,
                60 * 60, // 1 hour
                4 * 60 * 60, // 4 hours
              ),
            },
            dump: resumed.createDump
              ? {
                  url: await this.storageService.getDownloadUrl(
                    `jobs/${resumed.id}/results/${task.id}/tile.dump`,
                    60 * 60, // 1 hour
                    4 * 60 * 60, // 4 hours
                  ),
                }
              : undefined,
          })),
        ),
      };
    }

    // claim new task
    const result = await this.dataSource
      .createQueryBuilder()
      .update(RenderJob)
      .set({
        status: RenderJobStatus.MergeRunning,
        assignedTo: { id: workerNode.id },
      })
      .where({
        status: RenderJobStatus.MergePending,
      })
      .limit(1)
      .execute();
    if (result.affected === 1) {
      return this.getNextWorkerTask(workerNode);
    }

    return null;
  }

  async checkIfMergeWorkerTaskActive(
    jobId: number,
    workerNode: WorkerNode,
  ): Promise<boolean> {
    return this.dataSource.getRepository(RenderJob).exists({
      where: {
        id: jobId,
        assignedTo: { id: workerNode.id },
        status: RenderJobStatus.MergeRunning,
      },
    });
  }

  async getMergeResultUploadUrls(jobId: number) {
    const job = await this.dataSource
      .getRepository(RenderJob)
      .findOneOrFail({ where: { id: jobId } });
    return {
      image: await this.storageService.getUploadUrl(
        `jobs/${job.id}/result.png`,
        60 * 60,
      ),
      thumbnailImage: await this.storageService.getUploadUrl(
        `jobs/${job.id}/result_thumbnail.jpg`,
        60 * 60,
      ),
      dump: job.createDump
        ? await this.storageService.getUploadUrl(
            `jobs/${job.id}/result.dump`,
            60 * 60,
          )
        : undefined,
    };
  }

  async markMergeTaskAsCompleted(
    jobId: number,
    workerNode: WorkerNode,
  ): Promise<boolean> {
    const markCompletedResult = await this.dataSource
      .createQueryBuilder()
      .update(RenderJob)
      .set({
        status: RenderJobStatus.Completed,
        finishedAt: new Date(),
      })
      .where('id = :jobId', { jobId })
      .andWhere('status = :status', {
        status: RenderJobStatus.MergeRunning,
      })
      .andWhere('assignedTo = :workerNodeId', {
        workerNodeId: workerNode.id,
      })
      .execute();
    return markCompletedResult.affected === 1;
  }
}

interface WorkerTask {
  type: 'merge';
  job: {
    id: number;
    width: number;
    height: number;
  };
  tiles: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    image: { url: string };
    dump?: { url: string };
  }>;
}
