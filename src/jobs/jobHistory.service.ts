import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  RenderJobEvent,
  RenderJobEventReason,
  RenderJobEventType,
  RenderJobEventVisibility,
} from './entities/renderJobEvent.entity';

export interface NewRenderJobEvent {
  jobId: number;
  type: RenderJobEventType;
  visibility?: RenderJobEventVisibility;
  taskId?: number;
  node?: { id: number; type: 'renderer' | 'worker' };
  reason?: RenderJobEventReason;
}

@Injectable()
export class JobHistoryService {
  async append(
    manager: EntityManager,
    event: NewRenderJobEvent,
  ): Promise<void> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Job events must be appended within a transaction');
    }
    await manager.insert(RenderJobEvent, {
      job: { id: event.jobId },
      type: event.type,
      visibility: event.visibility ?? RenderJobEventVisibility.User,
      task: event.taskId == null ? null : { id: event.taskId },
      renderNode:
        event.node?.type === 'renderer' ? { id: event.node.id } : null,
      workerNode: event.node?.type === 'worker' ? { id: event.node.id } : null,
      reason: event.reason ?? null,
    });
  }

  async getHistoryByJob(
    manager: EntityManager,
    jobId: number,
    query: {
      page: number;
      limit: number;
      sort: 'createdAt';
      order: 'asc' | 'desc';
    },
    audience: RenderJobEventVisibility = RenderJobEventVisibility.User,
  ) {
    const [events, totalCount] = await manager.findAndCount(RenderJobEvent, {
      where:
        audience === RenderJobEventVisibility.Admin
          ? { job: { id: jobId } }
          : { job: { id: jobId }, visibility: RenderJobEventVisibility.User },
      loadRelationIds: {
        relations: ['job', 'task', 'renderNode', 'workerNode'],
        disableMixedMap: true,
      },
      order: { [query.sort]: query.order, id: query.order },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      data: events.map((event) => ({
        id: event.id,
        type: event.type,
        visibility: event.visibility,
        job: { id: event.job.id },
        task: event.task ? { id: event.task.id } : null,
        node:
          event.renderNode != null
            ? { id: event.renderNode.id, type: 'renderer' as const }
            : event.workerNode != null
              ? { id: event.workerNode.id, type: 'worker' as const }
              : null,
        reason: event.reason,
        createdAt: event.createdAt,
      })),
      extra: { page: { page: query.page, size: query.limit }, totalCount },
    };
  }
}
