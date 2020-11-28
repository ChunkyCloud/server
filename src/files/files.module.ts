import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  imports: [DatabaseModule],
})
export class FilesModule {}
