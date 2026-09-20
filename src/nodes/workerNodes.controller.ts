import {
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
import type { Request, Response } from 'express';
import { JobMergeStartedEvent, JobsBus } from '../jobs/jobs.bus';
import { CurrentWorkerNode, ExpectWorkerNode } from '../users/auth.guard';
import { FinishMergeTaskResponse } from './dto/finishMergeTaskResponse';
import { NextWorkerTaskResponse } from './dto/nextWorkerTaskResponse.dto';
import { WorkerNodeResponse } from './dto/workerNodeResponse';
import { WorkerNode } from './entities/workerNode.entity';
import { SchedulerService } from './scheduler.service';

@Controller('/worker-nodes')
export class WorkerNodesController {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly jobsBus: JobsBus,
  ) {}

  @ApiOperation({
    summary: 'Get the current worker node',
  })
  @ApiBearerAuth('worker-token')
  @ApiResponse({ status: HttpStatus.OK, type: WorkerNodeResponse })
  @Get('/me')
  @ExpectWorkerNode()
  getCurrentNode(
    @CurrentWorkerNode() workerNode: WorkerNode,
  ): WorkerNodeResponse {
    return workerNode;
  }

  @ApiOperation({
    summary: 'Get the next task for this worker node',
  })
  @ApiBearerAuth('worker-token')
  @ApiResponse({
    status: HttpStatus.OK,
    type: NextWorkerTaskResponse,
    description: 'The task this worker node should perform next',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'There is no task at this time',
  })
  @Get('/me/tasks/next')
  @ExpectWorkerNode()
  async getNextTask(
    @CurrentWorkerNode() workerNode: WorkerNode,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    let resolved = false;

    const tryGetTask = async () => {
      try {
        const task = await this.schedulerService.getNextWorkerTask(workerNode);
        if (task) {
          resolved = true;
          res.status(HttpStatus.OK).json(task satisfies NextWorkerTaskResponse);
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
      if (event instanceof JobMergeStartedEvent) {
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
    summary: 'Get result upload URLs and mark the merge task as uploading',
  })
  @ApiBearerAuth('worker-token')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'URLs to upload the merge results to',
    type: FinishMergeTaskResponse,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The task is not being rendered by this render node or already completed',
  })
  @Post('/me/tasks/merge/:jobId/upload')
  @ExpectWorkerNode()
  async getMergeTaskUploadUrls(
    @Param('jobId') jobId: number,
    @CurrentWorkerNode() workerNode: WorkerNode,
  ): Promise<FinishMergeTaskResponse> {
    const isMerging = await this.schedulerService.checkIfMergeWorkerTaskActive(
      jobId,
      workerNode,
    );
    if (!isMerging) {
      throw new ConflictException(
        'Job is not currently being merged by this worker node',
      );
    }

    return {
      uploadUrls: await this.schedulerService.getMergeResultUploadUrls(jobId),
    };
  }

  @ApiOperation({
    summary: 'Mark the merge task as completed after uploading the results',
  })
  @ApiBearerAuth('worker-token')
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Merge marked as completed',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The merge task can not be finished or required result files are missing',
  })
  @Post('/me/tasks/merge/:jobId/finish')
  @ExpectWorkerNode()
  @HttpCode(HttpStatus.ACCEPTED)
  async finishMergeTask(
    @Param('jobId') jobId: number,
    @CurrentWorkerNode() workerNode: WorkerNode,
  ): Promise<void> {
    const markedAsCompleted =
      await this.schedulerService.markMergeTaskAsCompleted(jobId, workerNode);
    if (!markedAsCompleted) {
      throw new ConflictException();
    }
  }
}
