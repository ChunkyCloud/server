import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { StatsEntryDocument } from './schemas/stats.schema';

export enum StatsEvent {
  JobCreated,
  JobFinished,
  JobFinishedPictureOnly,
  DumpMerged,
}

@Injectable()
export class StatsService {
  constructor(
    @InjectModel('Statistics')
    private readonly statsModel: Model<StatsEntryDocument>,
  ) {}

  async getStatsByDay(day: Date) {
    const today = new Date(day);
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    const todayStats = await this.statsModel.findOne({ date: today });
    return todayStats
      ? {
          date: today.toISOString().substr(0, 10),
          jobsCreated: todayStats.jobsCreated,
          jobsFinished: todayStats.jobsFinished,
          dumpsMerged: todayStats.dumpsMerged,
        }
      : {
          date: today.toISOString().substr(0, 10),
          jobsCreated: 0,
          jobsFinished: 0,
          dumpsMerged: 0,
        };
  }

  async updateStats(event: StatsEvent) {
    const today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);

    let inc: UpdateQuery<StatsEntryDocument>['$inc'];
    if (event === StatsEvent.JobCreated) {
      inc = { jobsCreated: 1 };
    } else if (event === StatsEvent.JobFinished) {
      inc = { jobsFinished: 1, dumpsMerged: 1 };
    } else if (event === StatsEvent.JobFinishedPictureOnly) {
      inc = { jobsFinished: 1 };
    } else if (event === StatsEvent.DumpMerged) {
      inc = { dumpsMerged: 1 };
    } else {
      return;
    }

    await this.statsModel.findOneAndUpdate(
      { date: today },
      { $inc: inc },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}
