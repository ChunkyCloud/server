import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { RenderTask } from 'src/jobs/entities/task.entity';
import { JobsBus, JobStartedEvent } from 'src/jobs/jobs.bus';
import {
  CurrentRenderNode,
  CurrentUserId,
  ExpectRenderNode,
} from 'src/users/auth.guard';
import { Repository } from 'typeorm';
import { CreateNodeDto } from './dto/createNode.dto';
import { CreateNodeResponse } from './dto/createNodeResponse.dto';
import { FinishTaskRenderingResponse } from './dto/finishTaskRenderingResponse.dto';
import { NextTaskResponse } from './dto/nextTaskResponse.dto';
import { RenderNodeResponse } from './dto/renderNodeResponse';
import { ReportTaskProgressDto } from './dto/reportTaskProgress.dto';
import { ResetNodeTokenResponse } from './dto/resetNodeTokenResponse';
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
    summary: 'Create a new render node',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.CREATED, type: CreateNodeResponse })
  @Post()
  async createNode(
    @Body() data: CreateNodeDto,
    @CurrentUserId() userId: number,
  ): Promise<CreateNodeResponse> {
    const { renderNode, token } = await this.nodesService.createRenderNode(
      userId,
      data,
    );
    return { id: renderNode.id, token };
  }

  @ApiOperation({
    summary: 'Reset the authentication token of a render node',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: ResetNodeTokenResponse })
  @HttpCode(HttpStatus.OK)
  @Post('/:id/reset-token')
  async resetNodeToken(
    @Param('id') id: number,
    @CurrentUserId() userId: number,
  ) {
    const { token } = await this.nodesService.resetRenderNodeToken(id, {
      assertUserId: userId,
    });
    return { token };
  }

  @ApiOperation({
    summary: 'Get the current render node',
  })
  @ApiBearerAuth('node-token')
  @ApiResponse({ type: RenderNodeResponse })
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
  @ApiBearerAuth('node-token')
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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    let resolved = false;

    const tryGetTask = async () => {
      try {
        const task = await this.schedulerService.getNextTask(renderNode);
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
              scene: {
                url: await this.schedulerService.getAssetUrl(
                  task.job.id,
                  'scene',
                ),
              },
              octree: {
                url: await this.schedulerService.getAssetUrl(
                  task.job.id,
                  'octree',
                ),
              },
              emittergrid: task.job.hasEmitterGrid
                ? {
                    url: await this.schedulerService.getAssetUrl(
                      task.job.id,
                      'emittergrid',
                    ),
                  }
                : undefined,
              resourcepacks: [
                {
                  id: '26.2',
                  url: 'https://piston-data.mojang.com/v1/objects/2dc72797acbc1b63fc16a11c4ac393605f453754/client.jar',
                },
              ],
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

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        this.jobsBus.remove(handler);
        res.status(HttpStatus.NO_CONTENT).end();
      }
    }, 25_000);

    const handler = (event: unknown) => {
      if (event instanceof JobStartedEvent) {
        void tryGetTask().then(() => {
          if (resolved) {
            this.jobsBus.remove(handler);
          }
        });
      }
    };
    this.jobsBus.subscribe(handler);

    req.on('close', () => {
      // client closed the connection
      clearTimeout(timeout);
      resolved = true;
      this.jobsBus.remove(handler);
    });
  }

  // TODO add cron job that re-queues locked tasks and tasks that fail to upload

  @ApiOperation({
    summary: 'Get result upload URLs and mark the task as uploading',
  })
  @ApiBearerAuth('node-token')
  @ApiResponse({
    status: HttpStatus.OK,
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
    const markedAsDone = await this.schedulerService.markTaskAsUploading(
      taskId,
      renderNode,
    );
    if (!markedAsDone) {
      throw new ConflictException('Task not running or uploading');
    }

    return {
      uploadUrls: await this.schedulerService.getResultUploadUrls(taskId),
    };
  }

  @ApiOperation({
    summary: 'Mark the task as completed after uploading the results',
  })
  @ApiBearerAuth('node-token')
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
    const markedAsCompleted = await this.schedulerService.markTaskAsCompleted(
      taskId,
      renderNode,
    );
    if (!markedAsCompleted) {
      throw new ConflictException();
    }
  }

  @ApiOperation({
    summary: 'Report the rendering progress of this task',
  })
  @ApiBearerAuth('node-token')
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
    @Body() { spp }: ReportTaskProgressDto,
  ): Promise<void> {
    const task = await this.tasks.findOne({
      where: { id: taskId, assignedTo: { id: renderNode.id } },
    });
    if (!task) {
      throw new ConflictException();
    }
    if (task.spp < spp) {
      throw new BadRequestException(
        `The task is only supposed to render to ${task.spp} spp`,
      );
    }

    const progressUpdated = await this.schedulerService.setTaskProgress(
      taskId,
      renderNode,
      spp,
    );
    if (!progressUpdated) {
      throw new ConflictException();
    }
  }
}
