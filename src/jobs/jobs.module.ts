import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { Asset } from './entities/asset.entity';
import { RenderJob } from './entities/job.entity';
import { RenderJobAsset } from './entities/jobAsset.entity';
import { RenderJobResourcePack } from './entities/resourcePack.entity';
import { RenderTask } from './entities/task.entity';
import { JobHistoryModule } from './jobHistory.module';
import { JobsBus } from './jobs.bus';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    JobHistoryModule,
    AccountingModule,
    TypeOrmModule.forFeature([
      RenderJob,
      RenderTask,
      RenderJobResourcePack,
      Asset,
      RenderJobAsset,
    ]),
    StorageModule,
    NodesModule,
  ],
  controllers: [JobsController],
  providers: [JobsBus, JobsService],
  exports: [JobsBus, JobsService],
})
export class JobsModule {}
