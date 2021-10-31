import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';

@Schema()
export class User {
  _id: ObjectId;

  @Prop()
  created: Date;

  @Prop({ select: false, unique: true })
  apiKey: string;

  @Prop({ unique: true })
  username: string;

  @Prop({ required: false, default: false })
  disabled?: boolean;

  @Prop({ required: false, default: false })
  admin?: boolean;

  @Prop({ required: false, default: false })
  system?: boolean;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);
