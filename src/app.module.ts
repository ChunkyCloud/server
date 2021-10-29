import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { QueuesModule } from './queues/queues.module';
import { StatsModule } from './stats/stats.module';
import { ResourcepacksModule } from './resourcepacks/resourcepacks.module';
import { NestMinioModule } from 'nestjs-minio';

@Module({
  imports: [
    DatabaseModule,
    FilesModule,
    JobsModule,
    QueuesModule,
    StatsModule,
    ResourcepacksModule,
    NestMinioModule.registerAsync({
      useFactory: () => ({
        useSSL: process.env.MINIO_SSL === 'true',
        endPoint: process.env.MINIO_ENDPOINT,
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
        port: parseInt(process.env.MINIO_PORT, 10),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
