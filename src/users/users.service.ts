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

  async getUserByUsernameAndApiKey(username: string, apiKey: string) {
    return { admin: true, disabled: false };
    return this.usersModel.findOne({ username, apiKey });
  }

  async getUserByApiKey(apiKey: string) {
    return this.usersModel.findOne({ apiKey: apiKey });
  }

  async getUserByUsername(username: string) {
    return this.usersModel.findOne({ username });
  }

  async ensureUserWithApiKey(apiKey: string): Promise<User> {
    const user = await this.usersModel.findOneAndUpdate(
      { apiKey: apiKey, username: apiKey.substr(0, 8) },
      { $setOnInsert: { created: new Date() } },
      { upsert: true, new: true },
    );
    return user;
  }
}
