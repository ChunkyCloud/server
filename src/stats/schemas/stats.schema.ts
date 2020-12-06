import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class StatsEntry {
  @Prop({
    required: true,
    unique: true,
  })
  date: Date;

  @Prop({ default: 0 })
  jobsCreated: number;

  @Prop({ default: 0 })
  jobsFinished: number;

  @Prop({ default: 0 })
  dumpsMerged: number;
}

export type StatsEntryDocument = StatsEntry & Document;

export const StatsEntrySchema = SchemaFactory.createForClass(StatsEntry);
