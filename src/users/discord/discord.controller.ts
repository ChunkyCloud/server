// auth.controller.ts

import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth.guard';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';
import { DiscordAuthGuard } from './discord.guard';

@Controller('/auth/discord')
export class DiscordAuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Public()
  @UseGuards(DiscordAuthGuard)
  async discordLogin() {
    // passport handles the redirect to Discord
  }

  @Get('callback')
  @Public()
  @UseGuards(DiscordAuthGuard)
  async discordCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    if (!user) {
      throw new UnauthorizedException();
    }
    const code = await this.authService.createAuthCode(user);
    res.send({ code });
  }
}
