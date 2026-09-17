import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  getAuthenticateOptions(
    context: ExecutionContext,
  ): Promise<IAuthModuleOptions | undefined> {
    const returnTo = context.switchToHttp().getRequest<Request>()
      .query.returnTo;
    if (
      returnTo &&
      (typeof returnTo !== 'string' ||
        !['localhost', 'website'].includes(returnTo))
    ) {
      throw new BadRequestException();
    }

    // state from the callee of the sso (e.g. the website)
    const upstreamState = context.switchToHttp().getRequest<Request>()
      .query.state;

    const nonce = randomBytes(32).toString('base64url');
    if (
      context.switchToHttp().getRequest<Request>().path.endsWith('/discord')
    ) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .cookie('oauth_nonce', nonce, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
        });
    }

    return Promise.resolve({
      ...super.getAuthenticateOptions(context),
      state: Buffer.from(
        JSON.stringify({ nonce, returnTo, upstreamState }),
      ).toString('base64url'),
    });
  }
}
