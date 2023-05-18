import {Prop, Schema, SchemaFactory} from "@nestjs/mongoose";
import {ObjectId} from "mongodb";
import {Document} from "mongoose";

@Schema()
export class FileEntry {
  _id: ObjectId;

  @Prop()
  filename: string;

  @Prop()
  type: string;

  @Prop()
  job?: ObjectId;

  @Prop()
  spp?: number;
}

export type FileEntryDocument = FileEntry & Document;

export const FileEntrySchema = SchemaFactory.createForClass(FileEntry);
