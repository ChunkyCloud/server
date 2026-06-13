import { Controller, Get, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserId } from './auth.guard';
import { UserResponseDto } from './dto/userResponse.dto';
import { User } from './entities/user.entity';

@Controller('/users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get('/me')
  @ApiOperation({ summary: 'Get the current user' })
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  async getCurrentUser(@CurrentUserId() id: number): Promise<UserResponseDto> {
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
