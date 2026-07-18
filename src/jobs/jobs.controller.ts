import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { SchedulerService } from 'src/nodes/scheduler.service';
import { StorageService } from 'src/storage/storage.service';
import { CurrentUserId } from 'src/users/auth.guard';
import { DataSource, In, QueryDeepPartialEntity, Repository } from 'typeorm';
import { CreateJobDto } from './dto/createJob.dto';
import { CreateJobResponse } from './dto/createJobResponse.dto';
import { TileResponse } from './dto/jobTilesResponse.dto';
import { RenderJob, RenderJobStatus } from './entities/job.entity';
import { RenderJobResourcePack } from './entities/resourcePack.entity';
import { RenderTask, RenderTaskStatus } from './entities/task.entity';
import { JobStartedEvent, JobsBus } from './jobs.bus';

@Controller('jobs')
export class JobsController {
  constructor(
    @InjectRepository(RenderJob)
    private readonly jobs: Repository<RenderJob>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly schedulerService: SchedulerService,
    private readonly jobsBus: JobsBus,
  ) {}

  @ApiOperation({ summary: 'Create a render job' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The job was created and scene files can now be uploaded',
    type: CreateJobResponse,
  })
  @Post()
  async createJob(
    @Body() data: CreateJobDto,
    @CurrentUserId() userId: number,
  ): Promise<CreateJobResponse> {
    const jobResourcePacks = this.dataSource.getRepository(
      RenderJobResourcePack,
    );
    const job = this.jobs.create({
      spp: data.spp,
      width: data.width,
      height: data.height,
      createDump: data.createDump ?? false,
      user: { id: userId },
      resourcePacks: data.resourcePacks.map(({ id }, i) =>
        jobResourcePacks.create({
          resourcePackId: id,
          orderIndex: i,
        }),
      ),
    });
    await this.jobs.save(job);

    const [scene, octree, emittergrid] = await Promise.all(
      [
        `jobs/${job.id}/assets/scene.json`,
        `jobs/${job.id}/assets/scene.octree2`,
        `jobs/${job.id}/assets/scene.emittergrid`,
      ].map((key) => this.storageService.getUploadUrl(key, 60 * 60)),
    );

    return {
      id: job.id,
      uploadUrls: { scene, octree, emittergrid },
    };
  }

  @ApiOperation({
    summary: 'Start a render job',
    description: 'Call this after all required files have been uploaded',
  })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'The job has been queued',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The job is not a draft or required scene files are missing',
  })
  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startJob(@Param('id') id: number, @CurrentUserId() userId: number) {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
    });
    if (!job) {
      throw new NotFoundException();
    }
    if (job.status !== RenderJobStatus.Draft) {
      // fast-fail optimization
      throw new ConflictException('Job is not a draft');
    }

    const exists = async (filename: string) =>
      this.storageService.checkKeyExists(`jobs/${job.id}/assets/${filename}`);
    const scene: unknown = JSON.parse(
      await this.storageService
        .getAsString(`jobs/${job.id}/assets/scene.json`)
        .catch((e) => {
          if (e instanceof NotFoundException) {
            throw new ConflictException('Missing scene file');
          }
          throw e;
        }),
    );
    if (job.hasEmitterGrid == null) {
      const hasEmitterGrid =
        typeof scene === 'object' &&
        scene != null &&
        'emitterSamplingStrategy' in scene &&
        scene.emitterSamplingStrategy !== 'NONE' &&
        !!scene.emitterSamplingStrategy;
      job.hasEmitterGrid = hasEmitterGrid;
      await this.jobs.update({ id: job.id }, { hasEmitterGrid });
    }
    if (!(await exists('scene.octree2'))) {
      throw new ConflictException('Missing octree file');
    }
    if (job.hasEmitterGrid) {
      if (!(await exists('scene.emittergrid'))) {
        throw new ConflictException('Missing emittergrid file');
      }
    }

    const tileSize = 200;
    const tasks: QueryDeepPartialEntity<RenderTask>[] = [];

    for (let y = 0; y < job.height; y += tileSize) {
      for (let x = 0; x < job.width; x += tileSize) {
        tasks.push({
          x,
          y,
          spp: job.spp,
          width: Math.min(tileSize, job.width - x),
          height: Math.min(tileSize, job.height - y),
          job: { id },
        });
      }
    }

    await this.dataSource.transaction(async (entityManager) => {
      const affected = await entityManager.update(
        RenderJob,
        {
          id,
          user: { id: userId },
          status: RenderJobStatus.Draft,
        },
        {
          status: RenderJobStatus.Queued,
          startedAt: new Date(),
        },
      );
      if (affected.affected !== 1) {
        // this ensures atomic job start / task creation
        throw new ConflictException('Job is not a draft');
      }
      await entityManager.insert(RenderTask, tasks);
    });

    this.jobsBus.publish(new JobStartedEvent(id));
  }

  @ApiOperation({ summary: 'Download scene files of a job' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'file', enum: ['scene', 'octree', 'emittergrid'] })
  @ApiResponse({ status: HttpStatus.OK, description: 'The file download' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The file does not exist',
  })
  @ApiResponse({
    status: HttpStatus.SEE_OTHER,
    description: 'The file can be downloaded at the URL in the Location header',
  })
  @Get(':id/files/:file')
  async getJobFile(
    @Res() res: Response,
    @Param('id') id: number,
    @Param('file') type: string,
    @CurrentUserId() userId: number,
  ) {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
    });
    if (!job) {
      throw new NotFoundException();
    }

    switch (type) {
      case 'scene':
        res.redirect(
          HttpStatus.SEE_OTHER,
          await this.schedulerService.getAssetUrl(id, 'scene'),
        );
        break;
      case 'octree':
        res.redirect(
          HttpStatus.SEE_OTHER,
          await this.schedulerService.getAssetUrl(id, 'octree'),
        );
        break;
      case 'emittergrid': {
        if (job.hasEmitterGrid !== true) {
          throw new NotFoundException(
            'This scene does not have an emittergrid',
          );
        }
        res.redirect(
          HttpStatus.SEE_OTHER,
          await this.schedulerService.getAssetUrl(id, 'emittergrid'),
        );
        break;
      }
      default:
        throw new NotFoundException(`Unknown file type: ${type}`);
    }
  }

  @ApiOperation({ summary: 'Abort a job' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The job was aborted',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The job could not be aborted because it is not queued or running',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The job does not exist or the user cannot access it',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/abort')
  async abortJob(@Param('id') id: number, @CurrentUserId() userId: number) {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
    });
    if (!job) {
      throw new NotFoundException();
    }

    const now = new Date();
    await this.dataSource.transaction(async (entityManager) => {
      const updateResult = await entityManager.update(
        RenderJob,
        { id, status: In([RenderJobStatus.Queued, RenderJobStatus.Running]) },
        {
          status: RenderJobStatus.Aborted,
          abortedAt: now,
        },
      );
      if (updateResult.affected !== 1) {
        throw new ConflictException();
      }

      await entityManager.update(
        RenderTask,
        {
          job: { id },
          status: In([
            RenderTaskStatus.Queued,
            RenderTaskStatus.Running,
            RenderTaskStatus.Uploading,
          ]),
        },
        {
          status: RenderTaskStatus.Aborted,
          abortedAt: now,
        },
      );
    });
  }

  @ApiOperation({ summary: 'Get the tiles of a job' })
  @ApiBearerAuth('access-token')
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The job does not exist or the user cannot access it',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'The tiles sorted by row and then column (i.e. the first tile is top left, the last tile is bottom right)',
    type: TileResponse,
    isArray: true,
  })
  @Get(':id/tiles')
  async getJobTiles(
    @Param('id') id: number,
    @CurrentUserId() userId: number,
  ): Promise<TileResponse[]> {
    const job = await this.jobs.findOne({
      where: {
        id,
        user: { id: userId },
      },
      relations: { tasks: true },
    });
    if (!job) {
      throw new NotFoundException();
    }

    const tiles = await Promise.all(
      job.tasks.map(async (task) => ({
        x: task.x,
        y: task.y,
        width: task.width,
        height: task.height,
        progress: task.currentSpp / task.spp,
        url:
          task.status === RenderTaskStatus.Completed
            ? await this.storageService.getDownloadUrl(
                `jobs/${job.id}/results/${task.id}/tile.png`,
                60 * 60, // 1 hour
              )
            : null,
      })),
    );
    tiles.sort((a, b) => {
      if (a.y === b.y) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });
    return tiles;
  }
}
