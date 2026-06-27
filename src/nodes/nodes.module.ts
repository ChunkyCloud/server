import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from 'src/storage/storage.module';
import { RenderNode } from './entities/renderNode.entity';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { SchedulerService } from './scheduler.service';
import { RenderTask } from 'src/jobs/entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RenderNode, RenderTask]), StorageModule],
  controllers: [NodesController],
  providers: [NodesService, SchedulerService],
  exports: [NodesService, SchedulerService],
})
export class NodesModule {}
