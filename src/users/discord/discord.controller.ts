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
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth.guard';
import { User } from '../entities/user.entity';
import { DiscordAuthGuard } from './discord.guard';
import { LoginService, parseLoginOptions } from '../login.service';

@Controller('/auth/discord')
export class DiscordAuthController {
  constructor(private readonly loginService: LoginService) {}

  @Get()
  @Public()
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({ summary: 'Initiate the Discord OAuth login' })
  @ApiQuery({
    name: 'state',
    required: false,
    description:
      'State that will be included in the redirect URL after successful login',
  })
  @ApiQuery({
    name: 'returnTo',
    description: 'Redirect destination after successful login',
    enum: ['website', 'localhost'],
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to Discord for OAuth authorization',
  })
  async discordLogin(): Promise<void> {
    // passport handles the redirect to Discord
  }

  @Get('callback')
  @Public()
  @UseGuards(DiscordAuthGuard)
  @ApiOperation({
    summary: 'Finish Discord OAuth login',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the auth code if "returnTo" was not specified',
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'Auth code that can be used to get a refresh token from the /auth/exchange endpoint. Only valid for a very short time.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
  })
  @ApiResponse({
    status: HttpStatus.SEE_OTHER,
    description:
      'Redirect to the destination previously specified by returnTo, will include "code" and, if specified during auth init, "state" query parameters',
  })
  async discordCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state: string,
  ): Promise<void> {
    let parsedState: unknown;
    try {
      parsedState = state
        ? JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
        : undefined;
    } catch {
      throw new BadRequestException();
    }
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });

    const user = req.user as User;
    if (!user) {
      throw new UnauthorizedException();
    }
    const options = parseLoginOptions(
      'returnTo' in parsedState ? parsedState.returnTo : undefined,
      'upstreamState' in parsedState ? parsedState.upstreamState : undefined,
    );
    await this.loginService.complete(user, options, res);
  }
}
