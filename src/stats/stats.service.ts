import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { RenderJob, RenderJobStatus } from '../jobs/entities/job.entity';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';
import { RenderNode } from '../nodes/entities/renderNode.entity';
import { DataSource } from 'typeorm';
import {
  HistoricalStatsResponse,
  PublicStatsResponse,
} from './dto/publicStatsResponse.dto';
import { MINIMUM_RENDERNODE_VERSION_CODE } from '../app.constants';

@Injectable()
export class StatsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getPublicStats(): Promise<PublicStatsResponse> {
    const renderNodesStats = await this.dataSource
      .getRepository(RenderNode)
      .createQueryBuilder('renderNode')
      .leftJoin(
        RenderTask,
        'renderTask',
        'renderTask.assignedToId = renderNode.id AND renderTask.status = :status',
        { status: RenderTaskStatus.Running },
      )
      .where('renderNode.lastSeenAt > NOW() - INTERVAL 3 MINUTE')
      .andWhere('renderNode.versionCode >= :minimumVersionCode', {
        minimumVersionCode: MINIMUM_RENDERNODE_VERSION_CODE,
      })
      .select('COUNT(DISTINCT renderTask.assignedToId)', 'renderingNodesCount')
      .addSelect('COUNT(DISTINCT renderNode.id)', 'connectedNodesCount')
      .getRawOne<{
        connectedNodesCount: string;
        renderingNodesCount: string;
      }>();

    const totalSps = await this.dataSource
      .getRepository(RenderNode)
      .createQueryBuilder('renderNode')
      .where('renderNode.currentSpsUpdatedAt > NOW() - INTERVAL 3 MINUTE')
      .select('SUM(renderNode.currentSps)', 'totalSps')
      .getRawOne<{ totalSps: string }>();

    const jobsByStatus = await this.dataSource
      .getRepository(RenderJob)
      .createQueryBuilder('renderJob')
      .select('renderJob.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('renderJob.status IN (:...statuses)', {
        statuses: [RenderJobStatus.Queued, RenderJobStatus.Running],
      })
      .groupBy('renderJob.status')
      .getRawMany<{ status: RenderJobStatus; count: string }>();

    const tasksByStatus = await this.dataSource
      .getRepository(RenderTask)
      .createQueryBuilder('renderTask')
      .select('renderTask.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('renderTask.status IN (:...statuses)', {
        statuses: [RenderTaskStatus.Queued, RenderTaskStatus.Running],
      })
      .groupBy('renderTask.status')
      .getRawMany<{ status: RenderTaskStatus; count: string }>();

    return {
      historical: await this.getHistoricalStats(),
      nodes: {
        connected: parseInt(renderNodesStats?.connectedNodesCount ?? '0', 10),
        rendering: parseInt(renderNodesStats?.renderingNodesCount ?? '0', 10),
      },
      totalSamplesPerSeconds: parseFloat(totalSps?.totalSps ?? '0'),
      jobs: {
        queued: parseInt(
          jobsByStatus.find((job) => job.status === RenderJobStatus.Queued)
            ?.count ?? '0',
          10,
        ),
        running: parseInt(
          jobsByStatus.find((job) => job.status === RenderJobStatus.Running)
            ?.count ?? '0',
          10,
        ),
      },
      tasks: {
        queued: parseInt(
          tasksByStatus.find((task) => task.status === RenderTaskStatus.Queued)
            ?.count ?? '0',
          10,
        ),
        running: parseInt(
          tasksByStatus.find((task) => task.status === RenderTaskStatus.Running)
            ?.count ?? '0',
          10,
        ),
      },
    };
  }

  private async getHistoricalStats(): Promise<HistoricalStatsResponse> {
    const now = new Date();
    const windows = {
      now,
      last24h: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      last7d: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    };
    const inLast24h = 'finishedAt >= :last24h AND finishedAt <= :now';
    const inLast7d = 'finishedAt >= :last7d AND finishedAt <= :now';

    const jobs = await this.dataSource
      .getRepository(RenderJob)
      .createQueryBuilder('job')
      .select('COUNT(*)', 'allTime')
      .addSelect(`SUM(CASE WHEN ${inLast24h} THEN 1 ELSE 0 END)`, 'last24h')
      .addSelect(`SUM(CASE WHEN ${inLast7d} THEN 1 ELSE 0 END)`, 'last7d')
      .where('job.status = :status', { status: RenderJobStatus.Completed })
      .setParameters(windows)
      .getRawOne<{
        allTime: string;
        last24h: string | null;
        last7d: string | null;
      }>();

    const tasks = await this.dataSource
      .getRepository(RenderTask)
      .createQueryBuilder('task')
      .select('COUNT(*)', 'allTime')
      .addSelect(`SUM(CASE WHEN ${inLast24h} THEN 1 ELSE 0 END)`, 'last24h')
      .addSelect(`SUM(CASE WHEN ${inLast7d} THEN 1 ELSE 0 END)`, 'last7d')
      .where('task.status = :status', { status: RenderTaskStatus.Completed })
      .setParameters(windows)
      .getRawOne<{
        allTime: string;
        last24h: string | null;
        last7d: string | null;
      }>();

    const period = (key: 'last24h' | 'last7d' | 'allTime') => ({
      completedJobs: Number(jobs?.[key] ?? 0),
      completedTasks: Number(tasks?.[key] ?? 0),
    });

    return {
      last24h: period('last24h'),
      last7d: period('last7d'),
      allTime: period('allTime'),
    };
  }
}
