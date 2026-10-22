import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { parseLoginOptions } from '../login.service';

@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  async getAuthenticateOptions(
    context: ExecutionContext,
  ): Promise<IAuthModuleOptions | undefined> {
    const req = context.switchToHttp().getRequest<Request>();
    const isCallback = req.path.endsWith('/callback');
    const options = isCallback
      ? {}
      : parseLoginOptions(req.query.returnTo, req.query.state);
    const nonce = randomBytes(32).toString('base64url');
    if (!isCallback) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .cookie('oauth_nonce', nonce, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
        });
    }

    return {
      ...(await super.getAuthenticateOptions(context)),
      state: Buffer.from(
        JSON.stringify({
          nonce,
          returnTo: options.returnTo,
          upstreamState: options.state,
        }),
      ).toString('base64url'),
    };
  }
}
