import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { FilesService } from '../database/files.service';
import { Job, JobDocument } from './schemas/job.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel('Job')
    private readonly jobsModel: Model<JobDocument>,
    private readonly files: FilesService,
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
}
