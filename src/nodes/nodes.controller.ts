import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { JobAssetType } from '../jobs/assets';
import { RenderTask } from '../jobs/entities/task.entity';
import {
  JobsBus,
  JobStartedEvent,
  RenderTasksAvailableEvent,
} from '../jobs/jobs.bus';
import { CurrentRenderNode, ExpectRenderNode } from '../users/auth.guard';
import { FinishTaskRenderingResponse } from './dto/finishTaskRenderingResponse.dto';
import { NextTaskResponse } from './dto/nextTaskResponse.dto';
import { RenderNodeResponse } from './dto/renderNodeResponse';
import { ReportTaskProgressDto } from './dto/reportTaskProgress.dto';
import { TaskPollQueryDto } from './dto/taskPollQuery.dto';
import { RenderNode } from './entities/renderNode.entity';
import { NodesService } from './nodes.service';
import { SchedulerService } from './scheduler.service';

@Controller('/nodes')
export class NodesController {
  constructor(
    private readonly nodesService: NodesService,
    private readonly schedulerService: SchedulerService,
    @InjectRepository(RenderTask)
    private readonly tasks: Repository<RenderTask>,
    private readonly jobsBus: JobsBus,
  ) {}

  @ApiOperation({
    summary: 'Get the current render node',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({ status: HttpStatus.OK, type: RenderNodeResponse })
  @Get('/me')
  @ExpectRenderNode()
  getCurrentNode(
    @CurrentRenderNode() renderNode: RenderNode,
  ): RenderNodeResponse {
    return renderNode;
  }

  @ApiOperation({
    summary: 'Get the next task for this node',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({
    status: HttpStatus.OK,
    type: NextTaskResponse,
    description: 'The task this render node should render next',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'There is no task to render at this time',
  })
  @Get('/me/tasks/next')
  @ExpectRenderNode()
  async getNextTask(
    @CurrentRenderNode() renderNode: RenderNode,
    @Query() { availableRam }: TaskPollQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    let resolved = false;

    const tryGetTask = async () => {
      try {
        const task = await this.schedulerService.getNextRenderTask(renderNode, {
          availableRam,
        });
        if (task) {
          resolved = true;
          res.status(HttpStatus.OK).json({
            id: task.id,
            job: {
              id: task.job.id,
              width: task.job.width,
              height: task.job.height,
            },
            spp: task.spp,
            tile: {
              x: task.x,
              y: task.y,
              width: task.width,
              height: task.height,
            },
            files: {
              ...(Object.fromEntries(
                await Promise.all(
                  task.job.assets.map(async (asset) => [
                    asset.role,
                    {
                      filename: asset.asset.filename,
                      url: await this.schedulerService.getAssetUrl(
                        task.job.id,
                        asset.role,
                      ),
                    },
                  ]),
                ),
              ) as Record<JobAssetType, { filename: string; url: string }>),
              resourcePacks: task.job.resourcePacks.map((resourcePack) => ({
                id: resourcePack.resourcePack.id,
                url: resourcePack.resourcePack.url!,
              })),
            },
          } satisfies NextTaskResponse);
        }
      } catch (e) {
        console.error('Getting next task failed', e);
        res.status(500).end();
        resolved = true;
      }
    };

    await tryGetTask();
    if (resolved) {
      return;
    }

    const listener = this.jobsBus.subscribe((event) => {
      if (
        event instanceof JobStartedEvent ||
        event instanceof RenderTasksAvailableEvent
      ) {
        void tryGetTask().then(() => {
          if (resolved) {
            listener.remove();
          }
        });
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        listener.remove();
        res.status(HttpStatus.NO_CONTENT).end();
      }
    }, 25_000);

    req.on('close', () => {
      // client closed the connection
      clearTimeout(timeout);
      resolved = true;
      listener.remove();
    });
  }

  // TODO add cron job that re-queues locked tasks and tasks that fail to upload

  @ApiOperation({
    summary: 'Get result upload URLs and mark the task as uploading',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'URLs to upload the render results to',
    type: FinishTaskRenderingResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The task is not being rendered by this render node or already completed',
  })
  @Post('/me/tasks/:id/upload')
  @ExpectRenderNode()
  async finishTaskRendering(
    @Param('id') taskId: number,
    @CurrentRenderNode() renderNode: RenderNode,
  ): Promise<FinishTaskRenderingResponse> {
    const markedAsDone = await this.schedulerService.markRenderTaskAsUploading(
      taskId,
      renderNode,
    );
    if (!markedAsDone) {
      throw new ConflictException('Task not running or uploading');
    }

    return {
      uploadUrls:
        await this.schedulerService.getRenderTaskResultUploadUrls(taskId),
    };
  }

  @ApiOperation({
    summary: 'Mark the task as completed after uploading the results',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Task marked as completed',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The task can not be finished or required result files are missing',
  })
  @Post('/me/tasks/:id/finish')
  @ExpectRenderNode()
  @HttpCode(HttpStatus.ACCEPTED)
  async finishTask(
    @Param('id') taskId: number,
    @CurrentRenderNode() renderNode: RenderNode,
  ): Promise<void> {
    const markedAsCompleted =
      await this.schedulerService.markRenderTaskAsCompleted(taskId, renderNode);
    if (!markedAsCompleted) {
      throw new ConflictException();
    }
  }

  @ApiOperation({
    summary: 'Report the rendering progress of this task',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Task progress updated',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The task is not assigned to this render node or was cancelled. The render node should stop rendering it.',
  })
  @Post('/me/tasks/:id/progress')
  @ExpectRenderNode()
  @HttpCode(HttpStatus.NO_CONTENT)
  async reportTaskProgress(
    @Param('id') taskId: number,
    @CurrentRenderNode() renderNode: RenderNode,
    @Body() { spp, sps }: ReportTaskProgressDto,
  ): Promise<void> {
    const task = await this.tasks.findOne({
      where: { id: taskId, assignedTo: { id: renderNode.id } },
    });
    if (!task) {
      throw new ConflictException();
    }

    await this.nodesService.updateCurrentSamplesPerSecond(renderNode.id, sps);

    const progressUpdated = await this.schedulerService.setRenderTaskProgress(
      taskId,
      renderNode,
      spp,
    );
    if (!progressUpdated) {
      throw new ConflictException();
    }
  }

  @ApiOperation({
    summary:
      'Notify the scheduler about the shutdown of this render node. This allows it to e.g. re-assign tasks without waiting for them to become stale.',
  })
  @ApiBearerAuth('renderer-token')
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @Post('/me/shutdown')
  @ExpectRenderNode()
  @HttpCode(HttpStatus.NO_CONTENT)
  async notifyRenderNodeShutdown(
    @CurrentRenderNode() renderNode: RenderNode,
  ): Promise<void> {
    await this.schedulerService.unassignTasksOfRenderNode(renderNode);
    await this.nodesService.updateCurrentSamplesPerSecond(renderNode.id, 0);
  }
}
