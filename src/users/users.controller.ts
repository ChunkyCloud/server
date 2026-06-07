import { Controller, Get, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserId } from './auth.guard';
import { User } from './entities/user.entity';

@Controller('/users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get('/me')
  async getCurrentUser(@CurrentUserId() id: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      // this should never happen
      throw new NotFoundException();
    }
    return {
      id,
      displayName: user.displayName,
    };
  }
}
