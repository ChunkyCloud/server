import { Module } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { FilesService } from './files.service';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URL || 'mongodb://localhost:27017/rs',
      {
        useCreateIndex: true,
        useFindAndModify: true,
      },
    ),
  ],
  providers: [
    FilesService,
    {
      provide: GridFSBucket,
      useFactory: (connection: Connection) =>
        new GridFSBucket(connection.db, { bucketName: 'fs' }),
      inject: [getConnectionToken()],
    },
  ],
  exports: [FilesService, GridFSBucket],
})
export class DatabaseModule {}
