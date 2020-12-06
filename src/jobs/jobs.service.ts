import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { FilesService } from '../database/files.service';
import { QueuesService } from '../queues/queues.service';
import { StatsEvent, StatsService } from '../stats/stats.service';
import { Job, JobDocument } from './schemas/job.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel('Job')
    private readonly jobsModel: Model<JobDocument>,
    private readonly files: FilesService,
    private readonly queues: QueuesService,
    private readonly stats: StatsService,
  ) {}

  getJobs({
    order,
    cursor,
    count,
  }: {
    order?: 'asc' | 'desc';
    cursor?: string;
    count?: number;
  }): Promise<JobDocument[]> {
    let find = {};
    if (cursor) {
      if (order === 'asc') {
        find = { _id: { $gt: new ObjectId(cursor) } };
      } else if (order === 'desc') {
        find = { _id: { $lt: new ObjectId(cursor) } };
      } else {
        throw new Error(`Order must be 'asc' or 'desc', but was ${order}`);
      }
    }

    return this.jobsModel
      .find(find)
      .sort({ _id: order === 'asc' ? 1 : -1 })
      .limit(count)
      .exec();
  }

  async getJob(
    id: string,
    options: { populateSceneDescription?: boolean } = {},
  ): Promise<Job & { sceneDescription?: any }> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const job = await this.jobsModel.findById(id);
    if (job && options.populateSceneDescription) {
      const sceneDescription = JSON.parse(
        await this.files.getFileContentAsString(job.files.scene),
      );
      return {
        ...job.toObject(),
        sceneDescription,
      };
    }
    return job;
  }

  getJobCount(): Promise<number> {
    return this.jobsModel.estimatedDocumentCount().exec();
  }

  async createJobWithOctree(config: {
    targetSpp: number;
    transient: boolean;
    texturepack?: string;
    scene: Buffer;
    octree: Buffer;
    emittergrid?: Buffer;
    skymap?: { data: Buffer; filename: string };
  }): Promise<Job> {
    const job = new this.jobsModel({
      spp: 0,
      created: new Date(),
      targetSpp: config.targetSpp,
      transient: config.transient,
      texturepack: config.texturepack,
      files: {},
    });
    const [scene, octree, emittergrid, skymap] = await Promise.all([
      this.files.addJobFile(job._id, 'scene', config.scene),
      this.files.addJobFile(job._id, 'octree', config.octree),
      config.emittergrid
        ? this.files.addJobFile(job._id, 'emittergrid', config.emittergrid)
        : null,
      config.skymap
        ? this.files.addJobFile(
            job._id,
            'skymap',
            config.skymap.data,
            config.skymap.filename,
          )
        : null,
    ]);
    job.files = {
      scene: scene._id,
      octree: octree._id,
      emittergrid: emittergrid?._id,
      skymap: skymap?._id,
    };
    await job.save();

    const sceneJson = JSON.parse(config.scene.toString('utf8'));
    const width = sceneJson.width;
    const height = sceneJson.height;
    const sppPerTask = Math.floor(
      Math.max(1, ((500 * 500) / (width * height)) * 100),
    );
    const normalTasks = Math.max(
      0,
      Math.floor(config.targetSpp / sppPerTask) - 1,
    );
    const lastTask = config.targetSpp - normalTasks * sppPerTask;
    await Promise.all([
      this.queues.addJob(job._id, normalTasks, sppPerTask),
      this.queues.addJob(job._id, 1, lastTask),
    ]);

    try {
      await this.stats.updateStats(StatsEvent.JobCreated);
    } catch {}

    return job;
  }

  async createJobWithRegions(config: {
    targetSpp: number;
    transient: boolean;
    texturepack?: string;
    scene: Buffer;
    regions: Array<{ data: Buffer; filename: string }>;
    reuseRegions: { [name: string]: string };
    skymap?: { data: Buffer; filename: string };
  }): Promise<Job> {
    const cachedRegionFiles = Object.fromEntries(
      (
        await Promise.all(
          Object.entries(config.reuseRegions).map(([name, hash]) =>
            this.files
              .getFileByNameAndHash(name, hash, 'region')
              .then((file) => [name, file?._id]),
          ),
        )
      ).filter(([name, id]) => id != null),
    );
    const missing = Object.keys(config.reuseRegions).filter(
      (name) => cachedRegionFiles[name] == null,
    );
    if (missing.length > 0) {
      const err = new Error();
      err['missingRegions'] = missing;
      throw err;
    }

    const job = new this.jobsModel({
      _id: new ObjectId(),
      spp: 0,
      created: new Date(),
      targetSpp: config.targetSpp,
      transient: config.transient,
      texturepack: config.texturepack,
      files: {},
    });
    const [scene, regions, skymap] = await Promise.all([
      this.files.addJobFile(job._id, 'scene', config.scene),
      Promise.all(
        config.regions.map((r) =>
          this.files.addJobFile(job._id, 'region', r.data, r.filename),
        ),
      ),
      config.skymap
        ? this.files.addJobFile(
            job._id,
            'skymap',
            config.skymap.data,
            config.skymap.filename,
          )
        : null,
    ]);
    job.files = {
      scene: scene._id,
      regions: [
        ...regions.map((r) => ({ id: r._id, name: r.filename })),
        ...Object.entries(cachedRegionFiles).map(([name, id]) => ({
          id,
          name,
        })),
      ],
      skymap: skymap?._id,
    };
    await job.save();

    await this.queues.addOctreeGeneration(job._id);

    try {
      await this.stats.updateStats(StatsEvent.JobCreated);
    } catch {}

    return job;
  }
}
