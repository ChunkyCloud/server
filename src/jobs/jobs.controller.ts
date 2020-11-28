import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  getJobs(
    @Query('count') count: number,
    @Query('order') order: 'asc' | 'desc',
    @Query('lastId') cursor: string,
  ) {
    return this.jobs.getJobs({
      order: order || 'desc',
      cursor,
      count: count || 100,
    });
  }

  @Get(':id')
  async getJob(@Param('id') id: string) {
    const job = await this.jobs.getJob(id, { populateSceneDescription: true });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    const files = [
      {
        type: 'scene',
        url: `/jobs/${job._id}/files/scene.json`,
      },
    ];
    if (job.files.octree) {
      job.files.push({
        type: 'octree',
        url: `/jobs/${job.forkedFrom || job._id}/files/scene.octree2`,
      });
    }
    if (job.files.emittergrid) {
      job.files.push({
        type: 'emittergrid',
        url: `/jobs/${job.forkedFrom || job._id}/files/scene.emittergrid`,
      });
    }
    if (job.files.regions) {
      job.files.push(
        ...job.files.regions.map((region) => ({
          type: 'region',
          name: region.name,
          url: `/files/${region.id}`,
        })),
      );
    }
    if (job.skymapId) {
      job.files.push({
        type: 'skymap',
        url: `/jobs/${job.forkedFrom || job._id}/files/skymap`,
      });
    }
    return {
      ...job,
      files,
    };
  }
}
