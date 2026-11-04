import { Command, CommandRunner, SubCommand } from 'nest-commander';
import { JobsService } from '../jobs.service';

function parseJobId(value: string): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError(`Bad job ID: ${value}`);
  }
  return id;
}

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
    const jobId = parseJobId(params[0]);
    await this.jobsService.abortJob(jobId);
    console.log(`Job ${params[0]} was aborted`);
  }
}

@SubCommand({
  name: 'get-priority',
  description: 'Read the internal priority of a job',
  arguments: '<id>',
})
export class GetJobPriorityCommand extends CommandRunner {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async run(params: string[]) {
    console.log(await this.jobsService.getJobPriority(parseJobId(params[0])));
  }
}

@SubCommand({
  name: 'set-priority',
  description: 'Set the internal priority of a job (0..255, higher is first)',
  arguments: '<id> <priority>',
})
export class SetJobPriorityCommand extends CommandRunner {
  constructor(private readonly jobsService: JobsService) {
    super();
  }

  async run(params: string[]) {
    const jobId = parseJobId(params[0]);
    const priority = Number(params[1]);
    if (
      !/^\d+$/.test(params[1]) ||
      !Number.isInteger(priority) ||
      priority > 255
    ) {
      throw new TypeError(`Bad priority: ${params[1]} (expected 0..255)`);
    }
    await this.jobsService.setJobPriority(jobId, priority);
    console.log(`Job ${jobId} priority set to ${priority}`);
  }
}

@Command({
  name: 'job',
  subCommands: [AbortJobCommand, GetJobPriorityCommand, SetJobPriorityCommand],
})
export class JobCommand extends CommandRunner {
  async run() {}
}
