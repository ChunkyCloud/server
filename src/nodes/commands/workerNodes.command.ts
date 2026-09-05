import { Command, CommandRunner, SubCommand } from 'nest-commander';
import { NodesService } from '../nodes.service';

@SubCommand({
  name: 'create',
  description: 'Create a new worker node',
  arguments: '<name>',
})
class CreateWorkerNodeCommand extends CommandRunner {
  constructor(private readonly nodesService: NodesService) {
    super();
  }

  async run(params: string[]) {
    const { token, workerNode } = await this.nodesService.createWorkerNode({
      name: params[0],
    });
    console.log('Worker node created successfully.');
    console.log('');
    console.log('ID:\t', workerNode.id);
    console.log('Name:\t', workerNode.name);
    console.log('Token:\t', token);
  }
}

@Command({
  name: 'worker-node',
  subCommands: [CreateWorkerNodeCommand],
})
export class WorkerNodeCommand extends CommandRunner {
  async run() {}
}
