import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  getAuthenticateOptions(
    context: ExecutionContext,
  ): IAuthModuleOptions | undefined {
    const returnTo = context.switchToHttp().getRequest<Request>()
      .query.returnTo;
    if (
      returnTo &&
      (typeof returnTo !== 'string' ||
        !['localhost', 'website'].includes(returnTo))
    ) {
      throw new BadRequestException();
    }

    return {
      ...super.getAuthenticateOptions(context),
      state: returnTo
        ? Buffer.from(JSON.stringify({ returnTo })).toString('base64url')
        : undefined,
    };
  }
}
