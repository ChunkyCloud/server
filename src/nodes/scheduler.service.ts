import { ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { LRUCache } from 'lru-cache';
import { RenderJob, RenderJobStatus } from 'src/jobs/entities/job.entity';
import { RenderTask, RenderTaskStatus } from 'src/jobs/entities/task.entity';
import { StorageService } from 'src/storage/storage.service';
import { DataSource, In, IsNull } from 'typeorm';
import { RenderNode } from './entities/renderNode.entity';

export class SchedulerService {
  /**
   * This caches signed URLs for job assets. They have a long lifetime, but
   * we don't want anyone to download them. Instead, only the assigned render
   * nodes get the links. By caching them, we avoid extra round trips on
   * every job assignment.
   */
  readonly #jobAssetUrls = new LRUCache({
    max: 1000,
    ttl: 12 * 60 * 60 * 1000, // 12 hours
    fetchMethod: (key: string) =>
      this.storageService.getDownloadUrl(key, 13 * 60 * 60), // 13 hours (overlap)
  });

  constructor(
    private readonly storageService: StorageService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getAssetUrl(
    jobId: number,
    file: 'scene' | 'octree' | 'emittergrid',
  ): Promise<string> {
    const url = await this.#jobAssetUrls.fetch(
      `jobs/${jobId}/assets/${{ scene: 'scene.json', octree: 'scene.octree2', emittergrid: 'scene.emittergrid' }[file]}`,
    );
    if (!url) {
      throw new Error(`Could not get asset url for job ${jobId} asset ${file}`);
    }
    return url;
  }

  async getResultUploadUrls(taskId: number) {
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

  async hasResultsFiles(taskId: number) {
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

  async getNextTask(renderNode: RenderNode): Promise<RenderTask | null> {
    // try to resume previously assigned task
    const resumed = await this.dataSource.getRepository(RenderTask).findOne({
      where: {
        assignedTo: { id: renderNode.id },
        status: RenderTaskStatus.Running,
      },
      relations: { job: { resourcePacks: { resourcePack: true } } },
      order: { job: { resourcePacks: { orderIndex: 'asc' } } },
    });
    if (resumed) {
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
      return this.getNextTask(renderNode);
    }

    return null;
  }

  async markTaskAsUploading(
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

  async markTaskAsCompleted(
    taskId: number,
    renderNode: RenderNode,
  ): Promise<boolean> {
    if (!(await this.hasResultsFiles(taskId))) {
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

      // mark job as completed if all tasks are completed
      const { job: jobId }: { job: number } = (await manager
        .getRepository(RenderTask)
        .findOneOrFail({
          select: { job: { id: true } },
          where: { id: taskId },
          loadRelationIds: { relations: ['job'] },
        })) as unknown as { job: number };
      await manager
        .createQueryBuilder()
        .update(RenderJob)
        .set({
          status: RenderJobStatus.Completed,
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
      return true;
    });
  }

  async setTaskProgress(
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
}
