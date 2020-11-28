import { Module } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobSchema } from './schemas/job.schema';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: 'Job', schema: JobSchema }]),
  ],
  providers: [JobsService],
  exports: [JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
