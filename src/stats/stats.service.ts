import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { RenderJobStatus } from '../jobs/entities/job.entity';
import { RenderTask, RenderTaskStatus } from '../jobs/entities/task.entity';
import { RenderNode } from '../nodes/entities/renderNode.entity';
import { DataSource } from 'typeorm';
import { PublicStatsResponse } from './dto/publicStatsResponse.dto';

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
      .select('COUNT(DISTINCT renderTask.assignedToId)', 'renderingNodesCount')
      .addSelect('COUNT(DISTINCT renderNode.id)', 'connectedNodesCount')
      .getRawOne<{
        connectedNodesCount: string;
        renderingNodesCount: string;
      }>();

    const jobsByStatus = await this.dataSource
      .getRepository('render_job')
      .createQueryBuilder('render_job')
      .select('render_job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('render_job.status')
      .getRawMany<{ status: RenderJobStatus; count: string }>();

    return {
      nodes: {
        connected: parseInt(renderNodesStats?.connectedNodesCount ?? '0', 10),
        rendering: parseInt(renderNodesStats?.renderingNodesCount ?? '0', 10),
      },
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
    };
  }
}
