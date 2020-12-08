import { Controller, Get, Logger } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { QueuesService } from '../queues/queues.service';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  private readonly logger = new Logger('StatsController');

  constructor(
    private readonly stats: StatsService,
    private readonly queues: QueuesService,
    private readonly jobs: JobsService,
  ) {}

  @Get()
  async getStats() {
    const [stats, jobStatsToday, jobCount] = await Promise.all([
      this.queues.getStats().catch((e) => {
        this.logger.error('Could not get queue stats', e);
        return null;
      }),
      this.stats.getStatsByDay(new Date()).catch((e) => {
        this.logger.error('Could not get job stats', e);
        return null;
      }),
      this.jobs.getJobCount().catch((e) => {
        this.logger.error('Could not get job count', e);
        return null;
      }),
    ]);

    return {
      health: {
        queues: stats == null ? 'err' : 'ok',
        database: jobStatsToday == null ? 'err' : 'ok',
      },
      ...stats,
      jobCount,
      today: jobStatsToday,
    };
  }
}
