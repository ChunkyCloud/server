import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module';
import { FilesModule } from '../files/files.module';
import { QueuesModule } from '../queues/queues.module';
import { ResourcepacksModule } from '../resourcepacks/resourcepacks.module';
import { StatsModule } from '../stats/stats.module';
import { UsersModule } from '../users/users.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobSchema } from './schemas/job.schema';

@Module({
  imports: [
    DatabaseModule,
    QueuesModule,
    MongooseModule.forFeature([{ name: 'Job', schema: JobSchema }]),
    forwardRef(() => StatsModule),
    ResourcepacksModule,
    FilesModule,
    UsersModule,
  ],
  providers: [JobsService],
  exports: [JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
