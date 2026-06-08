// auth.controller.ts

import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../auth.guard';
import { AuthService } from '../auth.service';
import { User } from '../entities/user.entity';
import { DiscordAuthGuard } from './discord.guard';

@Controller('/auth/discord')
export class DiscordAuthController {
  private readonly websiteAuthCallbackUrl: string | undefined;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.websiteAuthCallbackUrl = configService.get('WEBSITE_AUTH_CALLBACK');
  }

  @Get()
  @Public()
  @UseGuards(DiscordAuthGuard)
  async discordLogin() {
    // passport handles the redirect to Discord
  }

  @Get('callback')
  @Public()
  @UseGuards(DiscordAuthGuard)
  async discordCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state: string,
  ) {
    const parsedState: unknown = state
      ? JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
      : undefined;
    if (!parsedState || typeof parsedState !== 'object') {
      throw new BadRequestException();
    }

    const expectedNonce = req.cookies.oauth_nonce as unknown;
    if (
      !expectedNonce ||
      typeof expectedNonce !== 'string' ||
      !('nonce' in parsedState) ||
      parsedState.nonce !== expectedNonce
    ) {
      throw new BadRequestException();
    }

    res.cookie('oauth_nonce', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'production',
      sameSite: 'lax',
      maxAge: 0,
    });

    const user = req.user as User;
    if (!user) {
      throw new UnauthorizedException();
    }
    if ('returnTo' in parsedState && typeof parsedState.returnTo === 'string') {
      if (parsedState.returnTo === 'localhost') {
        res.redirect(
          HttpStatus.SEE_OTHER,
          `http://localhost:3000/api/auth/callback?code=${await this.authService.createAuthCode(user)}`,
        );
        return;
      } else if (
        parsedState.returnTo === 'website' &&
        this.websiteAuthCallbackUrl
      ) {
        res.redirect(
          HttpStatus.SEE_OTHER,
          `${this.websiteAuthCallbackUrl}?code=${await this.authService.createAuthCode(user)}`,
        );
        return;
      } else {
        throw new BadRequestException();
      }
    }

    res.send({ code: await this.authService.createAuthCode(user) });
  }
}
