import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { FilesService } from '../database/files.service';
import { CreateJobDto } from './dto/createJob.dto';
import { JobsService } from './jobs.service';
import { Job } from './schemas/job.schema';

const supportedTexturepacks = ['greenfield', 'chromahills-1.16-v1']; // TODO don't hard-code texturepacks

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly files: FilesService,
  ) {}

  @Get()
  getJobs(
    @Query('count') count?: number,
    @Query('order') order?: 'asc' | 'desc',
    @Query('lastId') cursor?: string,
  ) {
    return this.jobs.getJobs({
      order: order || 'desc',
      cursor,
      count: count || 100,
    });
  }

  @Get(':id')
  async getJob(@Param('id') id: string) {
    const { sceneDescription, ...job } = await this.jobs.getJob(id, {
      populateSceneDescription: true,
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    const files = [
      {
        type: 'scene',
        url: `/files/${job.files.scene}`,
      },
    ];
    if (job.files.octree) {
      files.push({
        type: 'octree',
        url: `/files/${job.files.octree}`,
      });
    }
    if (job.files.emittergrid) {
      files.push({
        type: 'emittergrid',
        url: `/files/${job.files.emittergrid}`,
      });
    }
    if (job.files.skymap) {
      files.push({
        type: 'skymap',
        url: `/files/${job.files.skymap}`,
      });
    }
    if (job.files.regions) {
      files.push(
        ...job.files.regions.map((region) => ({
          type: 'region',
          name: region.name,
          url: `/files/${region.id}`,
        })),
      );
    }
    return {
      ...job,
      files,
      sceneDescription: {
        width: sceneDescription.width,
        height: sceneDescription.height,
        rayDepth: sceneDescription.rayDepth,
      },
    };
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'scene', maxCount: 1 },
      { name: 'octree', maxCount: 1 },
      { name: 'emittergrid', maxCount: 1 },
      { name: 'skymap', maxCount: 1 },
      { name: 'region' },
    ]),
  )
  async createJob(@UploadedFiles() files, @Body() jobData: CreateJobDto) {
    if (jobData.texturepack) {
      if (!supportedTexturepacks.includes(jobData.texturepack)) {
        throw new BadRequestException('Unsupported texturepack');
      }
    }

    const { scene, octree, emittergrid, skymap, region } = files;

    if (
      scene == null ||
      (octree == null &&
        region == null &&
        (jobData.cachedRegions == null || jobData.cachedRegions.length === 0))
    ) {
      throw new BadRequestException('Incomplete scene files');
    }

    let job: Job;
    if (octree) {
      job = await this.jobs.createJobWithOctree({
        targetSpp: jobData.targetSpp || 1000,
        transient: jobData.transient === true,
        texturepack: jobData.texturepack,
        scene: scene[0].buffer,
        octree: octree[0].buffer,
        emittergrid: emittergrid?.[0].buffer,
        skymap: skymap
          ? { data: skymap[0].buffer, filename: skymap[0].originalname }
          : null,
      });
    } else {
      try {
        job = await this.jobs.createJobWithRegions({
          targetSpp: jobData.targetSpp || 1000,
          transient: jobData.transient === true,
          texturepack: jobData.texturepack,
          scene: scene[0].buffer,
          regions:
            region?.map((file) => ({
              data: file.buffer,
              filename: file.originalname,
            })) ?? [],
          reuseRegions: JSON.parse(jobData.cachedRegions || '{}'),
          skymap: skymap
            ? { data: skymap[0].buffer, filename: skymap[0].originalname }
            : null,
        });
      } catch (e) {
        if (e.missingRegions) {
          throw new BadRequestException({ missing: e.missingRegions });
        } else {
          throw e;
        }
      }
    }
    return job;
  }

  @Patch(':id')
  async updateJob(@Param('id') id: string, @Req() req: Request): Promise<Job> {
    // TODO allow the creator of a job to update it
    if (req.get('X-Api-Key') !== process.env.CC_ADMIN_KEY) {
      throw new ForbiddenException();
    }

    const job = await this.jobs.getJob(id);
    if (job == null) {
      throw new NotFoundException();
    }

    if (req.body.cancel) {
      return this.jobs.cancelJob(id);
    } else if (req.body.incTargetSpp) {
      const delta = parseInt(req.body.incTargetSpp, 10);
      if (delta > 0) {
        return this.jobs.increaseTargetSpp(id, delta);
      }
    } else {
      throw new BadRequestException();
    }
  }
}
