import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { Readable } from 'stream';
import { getValidatedDumpInfo } from 'chunky-dump-reader';
import * as asyncPool from 'tiny-async-pool';
import { FilesService } from '../database/files.service';
import { QueuesService } from '../queues/queues.service';
import { StatsEvent, StatsService } from '../stats/stats.service';
import { Job, JobDocument } from './schemas/job.schema';
import { DiskFilesService } from '../files/files.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('JobsService');
  private cleanupTimeout: NodeJS.Timeout = null;

  constructor(
    @InjectModel('Job')
    private readonly jobsModel: Model<JobDocument>,
    private readonly files: FilesService,
    private readonly disk: DiskFilesService,
    private readonly queues: QueuesService,
    private readonly stats: StatsService,
  ) {}

  onModuleInit() {
    this.cleanup();
  }

  onModuleDestroy() {
    if (this.cleanupTimeout != null) {
      clearTimeout(this.cleanupTimeout);
    }
  }

  private async cleanup() {
    try {
      const jobs = await this.jobsModel.find();
      for (const job of jobs) {
        const id = job._id;
        const oldFiles = await this.files.getOldJobFiles(id, 'dump');
        if (oldFiles.length > 0) {
          this.logger.verbose(
            `Removing ${oldFiles.length} (${
              oldFiles.reduce((sum, file) => sum + file.length, 0) / 1024 / 1024
            } mb) old dump files for ${id}`,
          );
          for (const file of oldFiles) {
            try {
              await this.files.deleteFile(file._id);
            } catch {}
          }
        }

        const oldPictures = await this.files.getOldJobFiles(id, 'picture');
        if (oldPictures.length > 0) {
          this.logger.verbose(
            `Removing ${oldPictures.length} (${
              oldPictures.reduce((sum, file) => sum + file.length, 0) /
              1024 /
              1024
            } mb) old picture files for ${id}`,
          );
          for (const file of oldFiles) {
            try {
              await this.files.deleteFile(file._id);
            } catch {}
          }
        }
      }
    } catch (e) {
      this.logger.error(
        'Could not remove old intermediate dumps and pictures',
        e,
      );
    }

    // remove transient jobs that are cancelled or finished more than 15 minutes ago
    try {
      const olderThan = new Date(Date.now() - 1000 * 60 * 15); // 15 minutes ago
      const oldJobs = await this.jobsModel.find({
        $and: [
          {
            transient: true,
          },
          {
            $or: [
              { finishedAt: { $lt: olderThan } },
              {
                cancelled: true,
                created: {
                  $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
                },
              },
            ],
          },
        ],
      });
      this.logger.verbose(
        `Removing ${
          oldJobs.length
        } canceled and finished transient jobs from before ${olderThan.toString()}`,
      );
      for (const job of oldJobs) {
        await this.deleteJob(job._id);
      }
    } catch (e) {
      this.logger.error('Could not remove old/cancelled transient jobs', e);
    }

    // remove transient jobs that were created more than 14 days ago, even if they didn't finish
    try {
      const olderThan = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
      const oldJobs = await this.jobsModel.find({
        transient: true,
        created: { $lt: olderThan },
      });
      this.logger.verbose(
        `Removing ${
          oldJobs.length
        } unfinished transient jobs from before ${olderThan.toString()}`,
      );
      await asyncPool(5, oldJobs, async (job) => {
        await this.deleteJob(job._id);
      });
    } catch (e) {
      this.logger.error('Could not remove old transient jobs', e);
    }

    // remove cached regions that are older than 14 days
    try {
      const olderThan = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
      const oldFiles = await this.files.getOldFiles('region', olderThan);
      this.logger.verbose(
        `Removing ${oldFiles.length} (${
          oldFiles.reduce((sum, file) => sum + file.length, 0) / 1024 / 1024
        } mb) cached region files from before ${olderThan.toString()}`,
      );
      await asyncPool(5, oldFiles, async (file) => {
        await this.files.deleteFile(file._id);
      });
    } catch (e) {
      this.logger.error('Could not remove old region file', e);
    }

    this.cleanupTimeout = setTimeout(async () => {
      await this.cleanup();
    }, 1000 * 60 * 5);
  }

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
      try {
        const sceneDescription = JSON.parse(
          await this.files.getFileContentAsString(job.files.scene),
        );
        return {
          ...job.toObject(),
          sceneDescription,
        };
      } catch (e) {
        if (e.message.includes('FileNotFound')) {
          this.logger.warn(
            `Scene description ${job.files.scene} for job ${id} was not found`,
          );
          return;
        }
      }
    }
    return job;
  }

  async deleteJob(id: string | ObjectId) {
    const _id = new ObjectId(id);
    await this.files.deleteJobFiles(_id);
    await this.jobsModel.deleteOne({ _id });
  }

  getLatestDump(id: string) {
    return this.files.getJobFile(id, 'dump');
  }

  private async updateLatestDump(
    id: string,
    dump: Buffer,
  ): Promise<{
    dumpInfo: {
      width: number;
      height: number;
      spp: number;
      renderTime: number;
    };
    file: { _id: ObjectId; filename: string };
  }> {
    const dumpInfo = await getValidatedDumpInfo(Readable.from(dump));
    const file = await this.files.addJobFile(
      new ObjectId(id),
      'dump',
      dump,
      `${id}.dump`,
    );
    return { dumpInfo, file };
  }

  getLatestPicture(id: string) {
    return this.files.getJobFile(id, 'picture');
  }

  private updateLatestPicture(
    id: string,
    picture: Buffer,
    spp: number,
  ): Promise<{ _id: ObjectId; filename: string }> {
    return this.files.addJobFile(
      new ObjectId(id),
      'picture',
      picture,
      `${id}.png`,
      { spp },
    );
  }

  getJobCount(): Promise<number> {
    return this.jobsModel.estimatedDocumentCount().exec();
  }

  async updateDumpAndPicture(
    id: string,
    dump: Buffer,
    picture: Buffer,
    mergedDumpFile?: string,
  ): Promise<Job> {
    const job = await this.getJob(id);
    if (job == null) {
      return null;
    }

    const { dumpInfo } = await this.updateLatestDump(id, dump);
    await this.updateLatestPicture(id, picture, dumpInfo.spp);

    const finishedNow = job.finishedAt == null && job.targetSpp <= dumpInfo.spp;

    const updatedJob = await this.jobsModel.findByIdAndUpdate(id, {
      spp: dumpInfo.spp,
      finishedAt: finishedNow ? new Date() : null,
    });

    try {
      if (finishedNow) {
        await this.stats.updateStats(StatsEvent.JobFinished);
      } else {
        await this.stats.updateStats(StatsEvent.DumpMerged);
      }
    } catch (e) {
      this.logger.error('Could not update stats', e);
    }

    try {
      if (mergedDumpFile) {
        if (ObjectId.isValid(mergedDumpFile)) {
          await this.files.deleteFile(new ObjectId(mergedDumpFile));
        } else {
          await this.disk.deleteFile(mergedDumpFile);
        }
      }
    } catch (e) {
      this.logger.warn('Could not remove intermediate dump', e);
    }

    return updatedJob;
  }

  async finishJobWithPicture(
    id: string,
    picture: Buffer,
    spp: number,
  ): Promise<Job> {
    const job = await this.getJob(id);
    if (job == null) {
      return null;
    }
    if (job.targetSpp !== spp || !job.pictureOnly) {
      // already done or can't use this picture as final result
      this.logger.warn(
        `Cannot finish job ${job._id} (${job.targetSpp}) with ${spp} spp; pictureOnly=${job.pictureOnly}`,
      );
      throw new Error('cannot use');
    }
    if (job.finishedAt != null && job.transient) {
      this.logger.warn(
        `Job ${id} is already done and transient, ignoring new final picture`,
      );
      return job;
    }

    await this.updateLatestPicture(id, picture, spp);

    const updatedJob = await this.jobsModel.findByIdAndUpdate(id, {
      spp,
      finishedAt: new Date(),
    });

    try {
      await this.stats.updateStats(StatsEvent.JobFinishedPictureOnly);
    } catch (e) {
      this.logger.error('Could not update stats', e);
    }

    return updatedJob;
  }

  async addIntermediateDump(
    id: string,
    dump: Buffer,
  ): Promise<{
    job: Job;
    dumpInfo: {
      width: number;
      height: number;
      spp: number;
      renderTime: number;
    };
    file: { _id: ObjectId; filename: string } | string;
  }> {
    const job = await this.getJob(id, { populateSceneDescription: true });
    if (job == null) {
      return null;
    }

    const dumpInfo: {
      width: number;
      height: number;
      spp: number;
      renderTime: number;
    } = await getValidatedDumpInfo(Readable.from(dump));
    if (
      dumpInfo.width === job.sceneDescription.width &&
      dumpInfo.height === job.sceneDescription.height
    ) {
      /*
      const file = await this.files.addJobFile(
        job._id,
        'intermediateDump',
        dump,
      );
      this.logger.log(
        `Intermediate dump for ${id} (${dumpInfo.spp} spp) saved as ${file._id}`,
      );
      await this.queues.addDump(id, file._id.toHexString());
      */
      const file = await this.disk.writeFile(dump);
      this.logger.log(
        `Intermediate dump for ${id} (${dumpInfo.spp} spp) saved as ${file}`,
      );
      await this.queues.addDump(id, file);
      return { job, dumpInfo, file };
    } else {
      throw new Error(`Invalid dump for job ${id}`);
    }
  }

  async addOctreeToJob(id: string, octree: Buffer, emittergrid?: Buffer) {
    const [octreeFile, emittergridFile] = await Promise.all([
      this.files.addJobFile(
        new ObjectId(id),
        'octree',
        octree,
        `${id}.octree2`,
      ),
      emittergrid
        ? this.files.addJobFile(
            new ObjectId(id),
            'emittergrid',
            emittergrid,
            `${id}.emittergrid`,
          )
        : null,
    ]);
    const job = await this.jobsModel.findByIdAndUpdate(id, {
      'files.octree': octreeFile._id,
      'files.emittergrid': emittergridFile?._id,
    });
    const sceneDescription = JSON.parse(
      await this.files.getFileContentAsString(job.files.scene),
    );
    const tasks = this.getJobTaskSplitting({
      width: sceneDescription.width,
      height: sceneDescription.height,
      targetSpp: job.targetSpp,
    });
    await Promise.all([
      this.queues.addJob(id, tasks.tasksCount, tasks.sppPerTask, 5), // TODO only for ChunkyMap
      this.queues.addJob(id, 1, tasks.remainingSpp, 5, false), // TODO only for ChunkyMap
    ]);
  }

  async createJobWithOctree(config: {
    targetSpp: number;
    transient: boolean;
    texturepack?: string;
    scene: Buffer;
    octree: Buffer;
    emittergrid?: Buffer;
    skymap?: { data: Buffer; filename: string };
    priority?: number;
    pictureOnly?: boolean;
  }): Promise<Job> {
    const job = new this.jobsModel({
      spp: 0,
      created: new Date(),
      targetSpp: config.targetSpp,
      transient: config.transient,
      texturepack: config.texturepack,
      pictureOnly: config.pictureOnly,
      files: {},
    });
    const [scene, octree, emittergrid, skymap] = await Promise.all([
      this.files.addJobFile(job._id, 'scene', config.scene, `${job._id}.json`),
      this.files.addJobFile(
        job._id,
        'octree',
        config.octree,
        `${job._id}.octree2`,
      ),
      config.emittergrid
        ? this.files.addJobFile(
            job._id,
            'emittergrid',
            config.emittergrid,
            `${job._id}.emittergrid`,
          )
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
    const tasks = this.getJobTaskSplitting({
      width: sceneJson.width,
      height: sceneJson.height,
      targetSpp: config.targetSpp,
    });
    await Promise.all([
      this.queues.addJob(
        job._id,
        tasks.tasksCount,
        tasks.sppPerTask,
        config.priority || 3,
      ),
      this.queues.addJob(
        job._id,
        1,
        tasks.remainingSpp,
        config.priority || 3,
        false,
      ),
    ]);

    try {
      await this.stats.updateStats(StatsEvent.JobCreated);
    } catch (e) {
      this.logger.error('Could not update stats', e);
    }

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
    pictureOnly?: boolean;
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
      pictureOnly: config.pictureOnly,
      files: {},
    });
    const [scene, regions, skymap] = await Promise.all([
      this.files.addJobFile(job._id, 'scene', config.scene),
      Promise.all(
        config.regions.map((r) =>
          this.files.addFile('region', r.data, r.filename),
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
    } catch (e) {
      this.logger.error('Could not update stats', e);
    }

    return job;
  }

  async cancelJob(id: string): Promise<Job> {
    return this.jobsModel.findByIdAndUpdate(
      id,
      { cancelled: true },
      { new: true },
    );
  }

  async increaseTargetSpp(id: string, delta: number): Promise<Job> {
    await this.jobsModel.updateOne(new ObjectId(id), {
      $inc: { targetSpp: delta },
    });
    const updatedJob = await this.getJob(id, {
      populateSceneDescription: true,
    });

    const tasks = this.getJobTaskSplitting({
      width: updatedJob.sceneDescription.width,
      height: updatedJob.sceneDescription.height,
      targetSpp: delta,
    });
    await Promise.all([
      this.queues.addJob(id, tasks.tasksCount, tasks.sppPerTask),
      this.queues.addJob(id, 1, tasks.remainingSpp),
    ]);

    return updatedJob;
  }

  private getJobTaskSplitting({
    width,
    height,
    targetSpp,
  }: {
    width: number;
    height: number;
    targetSpp: number;
  }): {
    sppPerTask: number;
    tasksCount: number;
    remainingSpp: number;
  } {
    // TODO take ray depth into account in the future
    const sppPerTask = Math.floor(
      Math.max(1, ((500 * 500) / (width * height)) * 100),
    );
    const tasksCount = Math.max(0, Math.floor(targetSpp / sppPerTask) - 1);
    const remainingSpp = targetSpp - tasksCount * sppPerTask;
    return {
      sppPerTask,
      tasksCount,
      remainingSpp,
    };
  }
}
