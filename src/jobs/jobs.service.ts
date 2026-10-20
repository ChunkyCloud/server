import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AccountingService,
  CreditTransactionType,
} from '../accounting/accounting.service';
import { RenderJob, RenderJobStatus } from './entities/job.entity';
import { RenderJobEventType } from './entities/renderJobEvent.entity';
import { RenderTask, RenderTaskStatus } from './entities/task.entity';
import { JobHistoryService } from './jobHistory.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobHistory: JobHistoryService,
    @InjectRepository(RenderJob)
    private readonly jobs: Repository<RenderJob>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly accounting: AccountingService,
  ) {}

  async abortJob(jobId: number): Promise<void> {
    const job = await this.jobs.findOne({
      where: { id: jobId },
      relations: { assets: { asset: true }, user: true },
    });
    if (!job) {
      throw new NotFoundException();
    }

    const now = new Date();
    await this.dataSource.transaction(async (entityManager) => {
      const updateResult = await entityManager.update(
        RenderJob,
        {
          id: job.id,
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
          job: { id: jobId },
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
        where: { job: { id: job.id }, status: RenderTaskStatus.Aborted },
        lock: { mode: 'pessimistic_write' },
      });
      const refund = canceledTasks.reduce(
        (total, task) => total + task.workUnits,
        0n,
      );
      if (refund > 0n) {
        await this.accounting.reward(entityManager, job.user.id, {
          amount: refund,
          type: CreditTransactionType.JobRefund,
          jobId: job.id,
        });
      }
    });
  }
}
