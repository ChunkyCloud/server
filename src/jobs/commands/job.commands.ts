import { Command, CommandRunner, SubCommand } from 'nest-commander';
import { JobsService } from '../jobs.service';

@SubCommand({
  name: 'abort',
  description: 'Abort a job',
  arguments: '<id>',
})
class AbortJobCommand extends CommandRunner {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async run(params: string[]) {
    const jobId = parseInt(params[0], 10);
    if (isNaN(jobId)) {
      throw new TypeError(`Bad job ID: ${params[0]}`);
    }
    await this.jobsService.abortJob(jobId);
    console.log(`Job ${params[0]} was aborted`);
  }
}

@Command({
  name: 'job',
  subCommands: [AbortJobCommand],
})
export class JobCommand extends CommandRunner {
  async run() {}
}
