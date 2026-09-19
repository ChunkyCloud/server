import { AccountingModule } from '../accounting/accounting.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { RenderJob } from './entities/job.entity';
import { RenderJobResourcePack } from './entities/resourcePack.entity';
import { RenderTask } from './entities/task.entity';
import { JobsBus } from './jobs.bus';
import { JobsController } from './jobs.controller';

@Module({
  imports: [
    AccountingModule,
    TypeOrmModule.forFeature([RenderJob, RenderTask, RenderJobResourcePack]),
    StorageModule,
    NodesModule,
  ],
  controllers: [JobsController],
  providers: [JobsBus],
  exports: [JobsBus],
})
export class JobsModule {}
