import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesService } from './files.service';
import {FileEntry, FileEntrySchema} from "./schemas/fileEntry.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: 'FileEntry', schema: FileEntrySchema }])],
  providers: [FilesService],
  exports: [FilesService],
})
export class DatabaseModule {}
