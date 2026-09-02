import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RenderTask } from 'src/jobs/entities/task.entity';
import { JobsModule } from 'src/jobs/jobs.module';
import { StorageModule } from 'src/storage/storage.module';
import { RenderNode } from './entities/renderNode.entity';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { SchedulerService } from './scheduler.service';
import { WorkerNode } from './entities/workerNode.entity';
import { WorkerNodesController } from './workerNodes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RenderNode, RenderTask, WorkerNode]),
    StorageModule,
    forwardRef(() => JobsModule),
  ],
  controllers: [NodesController, WorkerNodesController],
  providers: [NodesService, SchedulerService],
  exports: [NodesService, SchedulerService],
})
export class NodesModule {}
