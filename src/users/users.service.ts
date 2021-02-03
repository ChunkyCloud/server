import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User')
    private readonly usersModel: Model<UserDocument>,
  ) {}

  async getUser(id: string | ObjectId) {
    return this.usersModel.findById(id);
  }

  async getUserByApiKey(apiKey: string) {
    return this.usersModel.findOne({ apiKey: apiKey.toUpperCase() });
  }

  async ensureUserWithApiKey(apiKey: string): Promise<User> {
    const user = await this.usersModel.findOneAndUpdate(
      { apiKey: apiKey.toUpperCase() },
      { $setOnInsert: { created: new Date() } },
      { upsert: true, new: true },
    );
    return user;
  }
}
