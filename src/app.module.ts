import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { QueuesModule } from './queues/queues.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [DatabaseModule, FilesModule, JobsModule, QueuesModule, StatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
