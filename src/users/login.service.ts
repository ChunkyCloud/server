import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

export interface LoginOptions {
  returnTo?: 'website' | 'localhost';
  state?: string;
}

export function parseLoginOptions(
  returnTo: unknown,
  state: unknown,
): LoginOptions {
  if (
    returnTo !== undefined &&
    returnTo !== 'website' &&
    returnTo !== 'localhost'
  ) {
    throw new BadRequestException('Invalid returnTo');
  }
  if (state !== undefined && typeof state !== 'string') {
    throw new BadRequestException('Invalid state');
  }
  return { returnTo, state };
}

@Injectable()
export class LoginService {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  getCallbackUrl(returnTo: LoginOptions['returnTo']): URL | undefined {
    return returnTo
      ? new URL(
          this.config.getOrThrow<string>(
            returnTo === 'website'
              ? 'WEBSITE_AUTH_CALLBACK'
              : 'LOCALHOST_AUTH_CALLBACK',
          ),
        )
      : undefined;
  }

  async complete(
    user: User,
    options: LoginOptions,
    res: Response,
  ): Promise<void> {
    const destination = this.getCallbackUrl(options.returnTo);
    const code = await this.authService.createAuthCode(user);
    res.setHeader('Cache-Control', 'no-store');
    if (destination) {
      destination.searchParams.set('code', code);
      if (options.state !== undefined)
        destination.searchParams.set('state', options.state);
      res.redirect(HttpStatus.SEE_OTHER, destination.toString());
    } else {
      res.status(HttpStatus.OK).send({ code });
    }
  }
}
