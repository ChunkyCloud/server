import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, QueryDeepPartialEntity, Repository } from 'typeorm';
import {
  AccountingService,
  CreditTransactionType,
} from '../accounting/accounting.service';
import { calculateWorkUnits } from '../accounting/workUnits';
import { SchedulerService } from '../nodes/scheduler.service';
import { StorageService } from '../storage/storage.service';
import { CurrentUserId } from '../users/auth.guard';
import {
  JobAssetType,
  getAssetFilename,
  getSkyboxAssetKey,
  skyboxFaces,
} from './assets';
import { CreateJobDto, JobAssetsDto } from './dto/createJob.dto';
import { CreateJobResponse } from './dto/createJobResponse.dto';
import {
  EstimateJobCostDto,
  EstimateJobCostResponse,
} from './dto/estimateJobCost.dto';
import { TileResponse } from './dto/jobTilesResponse.dto';
import { UrlResponse } from './dto/urlResponse.dto';
import { Asset } from './entities/asset.entity';
import { RenderJob, RenderJobStatus } from './entities/job.entity';
import { RenderJobAsset } from './entities/jobAsset.entity';
import { RenderJobEventType } from './entities/renderJobEvent.entity';
import { RenderJobResourcePack } from './entities/resourcePack.entity';
import { RenderTask, RenderTaskStatus } from './entities/task.entity';
import { JobHistoryService } from './jobHistory.service';
import { JobStartedEvent, JobsBus } from './jobs.bus';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobHistory: JobHistoryService,
    @InjectRepository(RenderJob)
    private readonly jobs: Repository<RenderJob>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly schedulerService: SchedulerService,
    private readonly jobsBus: JobsBus,
    private readonly accounting: AccountingService,
  ) {}

  @Post('cost-estimate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Estimate render job cost without creating a job',
    description:
      'Uses width × height × SPP. Ray depth is not currently included.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: EstimateJobCostResponse })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid dimensions, SPP or work unit overflow',
  })
  estimateJobCost(@Body() data: EstimateJobCostDto): EstimateJobCostResponse {
    const workUnits = calculateWorkUnits(data.width, data.height, data.spp);
    return { workUnits: workUnits.toString(), credits: workUnits.toString() };
  }

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
    const assets: JobAssetsDto = data.assets ?? {};
    const job = await this.dataSource.transaction(async (manager) => {
      const createAsset = async (type: JobAssetType, fileType?: string) => {
        const asset = await manager.save(
          Asset,
          manager.create(Asset, {
            type,
            filename: getAssetFilename(type, fileType),
            storageKey: `assets/${randomUUID()}_${getAssetFilename(type, fileType)}`,
            user: { id: userId },
          }),
        );
        return manager.create(RenderJobAsset, {
          role: type,
          assetId: asset.id,
          asset,
        });
      };
      const jobAssets: RenderJobAsset[] = [
        await createAsset(JobAssetType.Scene),
        await createAsset(JobAssetType.Octree),
      ];
      if (data.assets?.emitterGrid) {
        jobAssets.push(await createAsset(JobAssetType.EmitterGrid));
      }
      if (data.skyMode === 'skymap') {
        if (!assets.skymap) {
          throw new BadRequestException(
            'Asset type for skymap is required when sky mode is skymap',
          );
        }
        jobAssets.push(
          await createAsset(JobAssetType.Skymap, assets.skymap.type),
        );
      } else if (data.skyMode === 'skybox') {
        for (const face of skyboxFaces) {
          const key = getSkyboxAssetKey(face);
          if (!assets[key]) {
            throw new BadRequestException(
              `Asset type for ${key} is required when sky mode is skybox`,
            );
          }
          jobAssets.push(
            await createAsset(
              key as unknown as JobAssetType,
              assets[key]?.type,
            ),
          );
        }
      }
      return manager.save(
        RenderJob,
        manager.create(RenderJob, {
          spp: data.spp,
          width: data.width,
          height: data.height,
          createDump: data.createDump ?? false,
          skyMode: data.skyMode ?? null,
          minimumRam: data.minimumRam ?? 0,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          user: { id: userId },
          assets: jobAssets,
          resourcePacks: data.resourcePacks.map(({ id }, orderIndex) =>
            manager.create(RenderJobResourcePack, {
              resourcePackId: id,
              orderIndex,
            }),
          ),
          workUnits: calculateWorkUnits(data.width, data.height, data.spp),
        }),
      );
    });
    const uploadUrls: Partial<Record<JobAssetType, string>> = {};
    for (const assignment of job.assets) {
      uploadUrls[assignment.role] = await this.storageService.getUploadUrl(
        assignment.asset.storageKey,
        60 * 60,
      );
    }
    return {
      id: job.id,
      expiresAt: job.expiresAt,
      uploadUrls: {
        ...uploadUrls,
        scene: uploadUrls.scene!,
        octree: uploadUrls.octree!,
      },
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
  async startJob(
    @Param('id') id: number,
    @CurrentUserId() userId: number,
  ): Promise<void> {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
      relations: { assets: { asset: true } },
    });
    if (!job) {
      throw new NotFoundException();
    }
    if (job.status !== RenderJobStatus.Draft) {
      // fast-fail optimization
      throw new ConflictException('Job is not a draft');
    }

    const assetKey = (role: JobAssetType) => {
      const assignment = job.assets.find((asset) => asset.role === role);
      if (!assignment) throw new ConflictException(`Missing ${role} asset`);
      return assignment.asset.storageKey;
    };
    const exists = (role: JobAssetType) =>
      this.storageService.checkKeyExists(assetKey(role));
    const scene: unknown = JSON.parse(
      await this.storageService
        .getAsString(assetKey(JobAssetType.Scene))
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
    if (!(await exists(JobAssetType.Scene))) {
      throw new ConflictException('Missing octree file');
    }
    if (job.hasEmitterGrid) {
      if (!(await exists(JobAssetType.EmitterGrid))) {
        throw new ConflictException('Missing emittergrid file');
      }
    }

    const skyAssets: JobAssetType[] = [
      ...(job.skyMode === 'skymap' ? [JobAssetType.Skymap] : []),
      ...(job.skyMode === 'skybox'
        ? (skyboxFaces.map(getSkyboxAssetKey) as unknown[] as JobAssetType[])
        : []),
    ];
    for (const asset of skyAssets) {
      if (!(await exists(asset))) {
        throw new ConflictException(`Missing ${asset} file`);
      }
    }

    const minTileSize = 100;
    const maxTileSize = job.createDump ? 200 : 500; // reduce tile size when dumps need to be uploaded
    const targetTileSize = Math.round(100 * Math.sqrt(500 / job.spp)); // targets 5 million samples per tile (100x100 at 500 SPP)
    const tileSize = Math.max(
      minTileSize,
      Math.min(maxTileSize, targetTileSize),
    );

    const tasks: QueryDeepPartialEntity<RenderTask>[] = [];
    for (let y = 0; y < job.height; y += tileSize) {
      for (let x = 0; x < job.width; x += tileSize) {
        const width = Math.min(tileSize, job.width - x);
        const height = Math.min(tileSize, job.height - y);
        tasks.push({
          x,
          y,
          spp: job.spp,
          width,
          height,
          workUnits: calculateWorkUnits(width, height, job.spp),
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
        },
      );
      if (affected.affected !== 1) {
        // this ensures atomic job start / task creation
        throw new ConflictException('Job is not a draft');
      }

      await this.accounting.charge(entityManager, userId, {
        amount: job.workUnits,
        type: CreditTransactionType.JobFee,
        jobId: id,
      });

      await entityManager.insert(RenderTask, tasks);
      await this.jobHistory.append(entityManager, {
        jobId: job.id,
        type: RenderJobEventType.JobQueued,
      });
    });

    this.jobsBus.publish(new JobStartedEvent(id));
  }

  @ApiOperation({ summary: 'Get the download url of a scene file of a job' })
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'file', enum: JobAssetType })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'The file does not exist',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'A download URL for the requested file, valid for at least 1 hour',
    type: UrlResponse,
  })
  @Get(':id/files/:file')
  async getJobFile(
    @Param('id') id: number,
    @Param('file') type: JobAssetType,
    @CurrentUserId() userId: number,
  ): Promise<UrlResponse> {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
      relations: { assets: { asset: true } },
    });
    if (!job) {
      throw new NotFoundException();
    }
    if (!Object.values(JobAssetType).includes(type)) {
      throw new BadRequestException(`Unknown file type: ${type}`);
    }

    switch (type) {
      case JobAssetType.Scene:
      case JobAssetType.Octree:
        return {
          url: await this.schedulerService.getAssetUrl(id, type),
        };
      case JobAssetType.EmitterGrid: {
        if (job.hasEmitterGrid !== true) {
          throw new NotFoundException(
            'This scene does not have an emittergrid',
          );
        }
        return {
          url: await this.schedulerService.getAssetUrl(id, type),
        };
      }
      case JobAssetType.Skymap: {
        if (job.skyMode !== 'skymap') {
          throw new NotFoundException('This scene does not have a skymap');
        }
        return {
          url: await this.schedulerService.getAssetUrl(id, type),
        };
      }
      case JobAssetType.SkyboxFront:
      case JobAssetType.SkyboxBack:
      case JobAssetType.SkyboxLeft:
      case JobAssetType.SkyboxRight:
      case JobAssetType.SkyboxTop:
      case JobAssetType.SkyboxBottom: {
        if (job.skyMode !== 'skybox') {
          throw new NotFoundException('This scene does not have a skybox');
        }
        return {
          url: await this.schedulerService.getAssetUrl(id, type),
        };
      }
      default:
        throw new NotFoundException(`Unknown file type: ${type as any}`);
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
  async abortJob(
    @Param('id') id: number,
    @CurrentUserId() userId: number,
  ): Promise<void> {
    const job = await this.jobs.findOne({
      where: { id, user: { id: userId } },
      relations: { assets: { asset: true } },
    });
    if (!job) {
      throw new NotFoundException();
    }

    const now = new Date();
    await this.dataSource.transaction(async (entityManager) => {
      const updateResult = await entityManager.update(
        RenderJob,
        {
          id,
          status: In([
            RenderJobStatus.Queued,
            RenderJobStatus.Running,
            RenderJobStatus.Draft,
          ]),
        },
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

      await this.jobHistory.append(entityManager, {
        jobId: job.id,
        type: RenderJobEventType.JobCancelled,
        reason: { code: 'user_cancelled' },
      });

      // The task update above excludes completed (and therefore rewarded) tasks.
      // A locking read sees the current state even if a completion committed
      // while the abort was waiting for its task locks.
      const canceledTasks = await entityManager.find(RenderTask, {
        select: { id: true, workUnits: true },
        where: { job: { id }, status: RenderTaskStatus.Aborted },
        lock: { mode: 'pessimistic_write' },
      });
      const refund = canceledTasks.reduce(
        (total, task) => total + task.workUnits,
        0n,
      );
      if (refund > 0n) {
        await this.accounting.reward(entityManager, userId, {
          amount: refund,
          type: CreditTransactionType.JobRefund,
          jobId: id,
        });
      }
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
                15 * 60, // 15 minutes
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
