import { RenderJobAsset } from '../jobs/entities/jobAsset.entity';
import { ConflictException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  Not,
} from 'typeorm';
import {
  AccountingService,
  CreditTransactionType,
} from '../accounting/accounting.service';
import { retryTransaction } from '../database/retryTransaction';
import { RenderJob, RenderJobStatus } from '../jobs/entities/job.entity';
import { RenderJobEventType } from '../jobs/entities/renderJobEvent.entity';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';
import { JobHistoryService } from '../jobs/jobHistory.service';
import {
  JobMergeStartedEvent,
  JobsBus,
  RenderTasksAvailableEvent,
} from '../jobs/jobs.bus';
import { type JobAssetType } from '../jobs/assets';
import { StorageService } from '../storage/storage.service';
import { RenderNode } from './entities/renderNode.entity';
import { WorkerNode } from './entities/workerNode.entity';

export class SchedulerService {
  constructor(
    private readonly jobHistory: JobHistoryService,
    private readonly storageService: StorageService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jobsBus: JobsBus,
    private readonly accounting: AccountingService,
  ) {}

  async getAssetUrl(jobId: number, file: JobAssetType): Promise<string> {
    const assignment = await this.dataSource
      .getRepository(RenderJobAsset)
      .findOneOrFail({
        where: { jobId, role: file },
        relations: { asset: true },
      });
    const url = await this.storageService.getDownloadUrl(
      assignment.asset.storageKey,
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

  async getNextRenderTask(
    renderNode: RenderNode,
    options: { availableRam?: number } = {},
  ): Promise<RenderTask | null> {
    const { availableRam = 0 } = options;

    // try to resume previously assigned task
    const resumed = await this.dataSource.getRepository(RenderTask).findOne({
      where: {
        assignedTo: { id: renderNode.id },
        status: In([RenderTaskStatus.Running, RenderTaskStatus.Uploading]),
      },
      relations: {
        job: { resourcePacks: { resourcePack: true }, assets: { asset: true } },
      },
      order: { job: { resourcePacks: { orderIndex: 'asc' } } },
    });
    if (resumed) {
      if (resumed.status !== RenderTaskStatus.Running) {
        const result = await this.dataSource.transaction(async (manager) => {
          const updated = await manager.getRepository(RenderTask).update(
            {
              id: resumed.id,
              assignedTo: { id: renderNode.id },
              status: RenderTaskStatus.Uploading,
            },
            { status: RenderTaskStatus.Running },
          );
          if (updated.affected === 1) {
            await this.jobHistory.append(manager, {
              jobId: resumed.job.id,
              taskId: resumed.id,
              node: { id: renderNode.id, type: 'renderer' },
              type: RenderJobEventType.TaskStarted,
              reason: { code: 'upload_resumed' },
            });
          }
          return updated;
        });
        if (result.affected !== 1) {
          return this.getNextRenderTask(renderNode, options);
        }
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
    const claimed = await this.dataSource.transaction(async (manager) => {
      const taskQuery = manager
        .getRepository(RenderTask)
        .createQueryBuilder('task')
        .innerJoinAndSelect('task.job', 'job')
        .where('task.status = :status', { status: RenderTaskStatus.Queued })
        .addSelect(
          'CASE WHEN job.userId = :nodeOwnerUserId THEN 0 ELSE 1 END',
          'nodeOwnerPriority',
        )
        .addSelect(
          'CAST(task.tip AS DECIMAL(65, 38)) / task.workUnits',
          'tipPerWorkUnit',
        )
        .setParameter('nodeOwnerUserId', renderNode.user.id)
        .orderBy('nodeOwnerPriority', 'ASC')
        .addOrderBy('tipPerWorkUnit', 'DESC')
        .addOrderBy('task.id', 'ASC')
        .take(1)
        .setLock('pessimistic_write');
      if (availableRam >= 0) {
        taskQuery.andWhere('job.minimumRam <= :availableRam', { availableRam });
      }
      const task = await taskQuery.getOne();
      if (!task) return false;
      await manager.update(RenderTask, task.id, {
        status: RenderTaskStatus.Running,
        assignedTo: { id: renderNode.id },
        startedAt: new Date(),
      });
      for (const type of [
        RenderJobEventType.TaskAssigned,
        RenderJobEventType.TaskStarted,
      ]) {
        await this.jobHistory.append(manager, {
          jobId: task.job.id,
          taskId: task.id,
          node: { id: renderNode.id, type: 'renderer' },
          type,
        });
      }
      return true;
    });
    return claimed ? this.getNextRenderTask(renderNode, options) : null;
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

    const outcome = await retryTransaction(() =>
      this.dataSource.transaction('READ COMMITTED', async (manager) => {
        const task = await manager.getRepository(RenderTask).findOneOrFail({
          select: { id: true, job: { id: true }, workUnits: true, tip: true },
          where: { id: taskId },
          relations: { job: true },
        });
        const jobId = task.job.id;

        // Serialize completions before locking a task or inserting history/
        // credit rows, whose foreign keys also acquire locks on the job.
        // This also follows the job -> task order used by job cancellation.
        await manager.getRepository(RenderJob).findOneOrFail({
          where: { id: jobId },
          lock: { mode: 'pessimistic_write' },
        });

        const tasks = manager.getRepository(RenderTask);
        const result = await tasks.update(
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
          return { completed: false };
        }

        await this.jobHistory.append(manager, {
          jobId,
          taskId,
          node: { id: renderNode.id, type: 'renderer' },
          type: RenderJobEventType.TaskCompleted,
        });

        // Give credits to user the render node belongs to
        await this.accounting.reward(manager, renderNode.user.id, {
          amount: task.workUnits + task.tip,
          type: CreditTransactionType.RenderReward,
          taskId,
          jobId,
        });

        // Mark queued/running job as merge pending if all tasks are completed
        // Plain reads avoid the locking subqueries in UPDATE ... NOT EXISTS.
        // READ COMMITTED sees completions committed while we waited for the
        // job lock, rather than an earlier transaction snapshot.
        const hasUncompletedTasks = await tasks.exists({
          where: {
            job: { id: jobId },
            status: Not(RenderTaskStatus.Completed),
          },
        });
        if (!hasUncompletedTasks) {
          const mergeResult = await manager.getRepository(RenderJob).update(
            {
              id: jobId,
              status: In([RenderJobStatus.Queued, RenderJobStatus.Running]),
            },
            { status: RenderJobStatus.MergePending },
          );
          return {
            completed: true,
            mergeJobId: mergeResult.affected === 1 ? jobId : undefined,
          };
        }

        const hasRunningTasks = await tasks.exists({
          where: {
            job: { id: jobId },
            status: In([RenderTaskStatus.Running, RenderTaskStatus.Uploading]),
          },
        });
        if (!hasRunningTasks) {
          const queuedResult = await manager
            .getRepository(RenderJob)
            .update(
              { id: jobId, status: RenderJobStatus.Running },
              { status: RenderJobStatus.Queued },
            );
          if (queuedResult.affected === 1) {
            await this.jobHistory.append(manager, {
              jobId,
              type: RenderJobEventType.JobQueued,
              reason: { code: 'waiting_for_tasks' },
            });
          }
        }
        return { completed: true };
      }),
    );
    if (outcome.mergeJobId !== undefined) {
      this.jobsBus.publish(new JobMergeStartedEvent(outcome.mergeJobId));
    }
    return outcome.completed;
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

  private async requeueTasks(
    where: FindOptionsWhere<RenderTask>,
    reason: { code: string },
  ): Promise<number> {
    const count = await this.dataSource.transaction(async (manager) => {
      const tasks = await manager.find(RenderTask, {
        where,
        relations: { job: true, assignedTo: true },
        lock: { mode: 'pessimistic_write' },
      });
      for (const task of tasks) {
        const event = {
          jobId: task.job.id,
          taskId: task.id,
          node: task.assignedTo
            ? { id: task.assignedTo.id, type: 'renderer' as const }
            : undefined,
        };
        await manager.update(RenderTask, task.id, {
          status: RenderTaskStatus.Queued,
          assignedTo: null!,
          currentSpp: 0,
          startedAt: null!,
          currentSppUpdatedAt: null!,
        });
        await this.jobHistory.append(manager, {
          ...event,
          type: RenderJobEventType.TaskRequeued,
          reason,
        });
      }
      return tasks.length;
    });
    // TODO mark job as queued if no task is running now
    if (count > 0) this.jobsBus.publish(new RenderTasksAvailableEvent());
    return count;
  }

  async unassignTasksOfRenderNode(renderNode: RenderNode) {
    await this.requeueTasks(
      {
        assignedTo: { id: renderNode.id },
        status: In([
          RenderTaskStatus.Queued,
          RenderTaskStatus.Running,
          RenderTaskStatus.Uploading,
        ]),
      },
      { code: 'node_shutdown' },
    );
  }

  @Interval(5 * 60 * 1000)
  async unassignStuckRenderTasks() {
    await this.requeueTasks(
      {
        status: In([RenderTaskStatus.Running, RenderTaskStatus.Uploading]),
        assignedTo: {
          lastSeenAt: LessThan(new Date(Date.now() - 5 * 60 * 1000)),
        },
      },
      { code: 'node_offline' },
    );
    await this.requeueTasks(
      {
        status: RenderTaskStatus.Uploading,
        updatedAt: LessThan(new Date(Date.now() - 15 * 60 * 1000)),
      },
      { code: 'upload_timeout' },
    );
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
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.update(
        RenderJob,
        {
          id: jobId,
          status: RenderJobStatus.MergeRunning,
          assignedTo: { id: workerNode.id },
        },
        { status: RenderJobStatus.Completed, finishedAt: new Date() },
      );
      if (result.affected !== 1) return false;
      await this.jobHistory.append(manager, {
        jobId,
        type: RenderJobEventType.JobCompleted,
        node: { id: workerNode.id, type: 'worker' },
      });
      return true;
    });
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
