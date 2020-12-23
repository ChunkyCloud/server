import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FilesService } from '../database/files.service';
import { FilesController } from './files.controller';
import { DiskFilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, DiskFilesService],
  imports: [DatabaseModule],
  exports: [FilesService, DiskFilesService],
})
export class FilesModule {}
