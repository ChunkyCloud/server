import { Controller, Get } from '@nestjs/common';
import { CurrentUserId } from './auth.guard';

@Controller('/users')
export class UsersController {
  @Get('/me')
  getCurrentUser(@CurrentUserId() id: number) {
    return {
      id,
    };
  }
}
