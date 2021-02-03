import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';

@Schema()
export class User {
  _id: ObjectId;

  @Prop()
  created: Date;

  @Prop()
  apiKey: string;

  @Prop({ required: false })
  username?: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
