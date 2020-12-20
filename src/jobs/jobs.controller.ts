import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { FilesService } from '../database/files.service';
import { ResourcepacksService } from '../resourcepacks/resourcepacks.service';
import { serveFile } from '../util/serveFile';
import { CreateJobDto } from './dto/createJob.dto';
import { JobsService } from './jobs.service';
import { Job } from './schemas/job.schema';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly files: FilesService,
    private readonly resourcepacks: ResourcepacksService,
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
    const job = await this.jobs.getJob(id, {
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
        width: job.sceneDescription.width,
        height: job.sceneDescription.height,
        rayDepth: job.sceneDescription.rayDepth,
      },
    };
  }

  @Get(':id/latest.dump')
  async getLatestDump(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const job = await this.jobs.getJob(id);
    if (job == null) {
      throw new NotFoundException();
    }

    const file = await this.jobs.getLatestDump(id);
    if (file == null) {
      res.status(204).end();
    } else {
      res.set('Content-Disposition', `inline; filename="${job._id}.dump"`);
      await serveFile((id) => this.files.getFileStream(id), file, res, {
        ifModifiedSince: req.get('If-Modified-Since'),
        contentType: 'application/octet-stream',
      });
    }
  }

  @Get(':id/latest.png')
  async getLatestPicture(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const job = await this.jobs.getJob(id);
    if (job == null) {
      throw new NotFoundException();
    }

    const file = await this.jobs.getLatestPicture(id);
    if (file == null) {
      res.status(204).end();
    } else {
      res.set(
        'Content-Disposition',
        `inline; filename="${job._id}-${file['metadata']?.spp ?? job.spp}.png"`,
      );
      await serveFile((id) => this.files.getFileStream(id), file, res, {
        ifModifiedSince: req.get('If-Modified-Since'),
        contentType: 'image/png',
      });
    }
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
  async createJob(
    @UploadedFiles() files,
    @Body() jobData: CreateJobDto,
    @Req() req: Request,
  ) {
    // TODO proper authentication with api key
    if (
      req.get('User-Agent').startsWith('ChunkyMap') &&
      !req.get('X-Api-Key')
    ) {
      throw new ForbiddenException('Missing or invalid API key');
    }

    if (jobData.texturepack) {
      const hasResourcepack = await this.resourcepacks.hasResourcepack(
        jobData.texturepack,
      );
      if (!hasResourcepack) {
        throw new BadRequestException(
          `Unsupported resourcepack: ${jobData.texturepack}`,
        );
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
        targetSpp: Math.min(5000, jobData.targetSpp || 1000),
        transient:
          jobData.transient === true ||
          req.get('User-Agent').startsWith('ChunkyMap'),
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
          targetSpp: Math.min(5000, jobData.targetSpp || 1000),
          transient:
            jobData.transient === true ||
            req.get('User-Agent').startsWith('ChunkyMap'),
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

  @Post(':id/latestDump')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dump', maxCount: 1 },
      { name: 'picture', maxCount: 1 },
    ]),
  )
  async uploadDump(
    @Param('id') id: string,
    @UploadedFiles() files,
    @Req() req: Request,
  ): Promise<Job> {
    if (req.get('X-Api-Key') !== process.env.CC_DUMP_PROCESSOR_KEY) {
      throw new ForbiddenException();
    }

    const { dump, picture } = files;
    if (
      dump == null ||
      dump.length === 0 ||
      picture == null ||
      picture.length === 0
    ) {
      throw new BadRequestException('Missing files');
    }

    const updatedJob = await this.jobs.updateDumpAndPicture(
      id,
      dump[0].buffer,
      picture[0].buffer,
    );
    if (updatedJob == null) {
      throw new NotFoundException();
    }
    return updatedJob;
  }

  @Post(':id/files')
  @HttpCode(204)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'octree', maxCount: 1 },
      { name: 'emittergrid', maxCount: 1 },
    ]),
  )
  async uploadSceneFiles(@Param('id') id: string, @UploadedFiles() files) {
    // TODO authentication with api key

    const { octree, emittergrid } = files;
    if (octree == null || octree.length === 0) {
      throw new BadRequestException('Missing octree');
    }

    await this.jobs.addOctreeToJob(
      id,
      octree[0].buffer,
      emittergrid?.[0]?.buffer,
    );
  }
}
