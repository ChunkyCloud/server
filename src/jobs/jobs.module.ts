import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesModule } from 'src/nodes/nodes.module';
import { StorageModule } from 'src/storage/storage.module';
import { RenderJob } from './entities/job.entity';
import { RenderTask } from './entities/task.entity';
import { JobsBus } from './jobs.bus';
import { JobsController } from './jobs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RenderJob, RenderTask]),
    StorageModule,
    NodesModule,
  ],
  controllers: [JobsController],
  providers: [JobsBus],
  exports: [JobsBus],
})
export class JobsModule {}
