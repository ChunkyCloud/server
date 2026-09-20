import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { RenderTask } from '../jobs/entities/task.entity';
import { JobHistoryModule } from '../jobs/jobHistory.module';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';
import { RenderNode } from './entities/renderNode.entity';
import { WorkerNode } from './entities/workerNode.entity';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { SchedulerService } from './scheduler.service';
import { WorkerNodesController } from './workerNodes.controller';

@Module({
  imports: [
    JobHistoryModule,
    AccountingModule,
    TypeOrmModule.forFeature([RenderNode, RenderTask, WorkerNode]),
    StorageModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [NodesController, WorkerNodesController],
  providers: [NodesService, SchedulerService],
  exports: [NodesService, SchedulerService],
})
export class NodesModule {}
