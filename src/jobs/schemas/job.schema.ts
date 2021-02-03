import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Document, SchemaTypes } from 'mongoose';

@Schema()
export class Job {
  _id: ObjectId;

  @Prop()
  created: Date;

  @Prop()
  spp: number;

  @Prop()
  targetSpp: number;

  @Prop()
  forkedFrom?: ObjectId;

  @Prop({ type: SchemaTypes.Mixed })
  files: any;

  @Prop()
  transient?: boolean;

  @Prop()
  finishedAt?: Date;

  @Prop()
  renderTime?: number;

  @Prop()
  texturepack?: string;

  @Prop()
  cancelled?: boolean;

  @Prop()
  pictureOnly?: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: ObjectId;
}

export type JobDocument = Job & Document;

export const JobSchema = SchemaFactory.createForClass(Job);
