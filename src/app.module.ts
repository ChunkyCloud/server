import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { QueuesModule } from './queues/queues.module';
import { StatsModule } from './stats/stats.module';
import { ResourcepacksModule } from './resourcepacks/resourcepacks.module';
import { NestMinioModule } from 'nestjs-minio';
import { UsersModule } from './users/users.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import {MongooseModule} from "@nestjs/mongoose";

@Module({
  imports: [
    DatabaseModule,
    FilesModule,
    JobsModule,
    QueuesModule,
    StatsModule,
    ResourcepacksModule,
    UsersModule,
    RabbitMqModule,
    NestMinioModule.registerAsync({
      useFactory: () => ({
        useSSL: process.env.MINIO_SSL === 'true',
        endPoint: process.env.MINIO_ENDPOINT,
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
        port: parseInt(process.env.MINIO_PORT, 10),
      }),
    }),
    MongooseModule.forRoot(
      process.env.MONGO_URL || 'mongodb://localhost:27017/rs',
      {
        useCreateIndex: true,
        useFindAndModify: false,
        poolSize: parseInt(process.env.MONGO_POOLSIZE || '30', 10),
      },
    ),
  ],
  controllers: [AppController],
})
export class AppModule {}
