import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FilesService } from '../database/files.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [DatabaseModule],
  exports: [FilesService],
})
export class FilesModule {}
