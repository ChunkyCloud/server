import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RenderNode } from 'src/nodes/entities/renderNode.entity';
import { NodesService } from 'src/nodes/nodes.service';
import { AuthService } from './auth.service';
import { MINIMUM_RENDERNODE_VERSION_CODE } from 'src/app.constants';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly nodesService: NodesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const bearerTokenValue = req.headers.authorization?.substring(
      'Bearer '.length,
    );
    if (!bearerTokenValue) {
      throw new UnauthorizedException();
    }

    const expectRenderNode = this.reflector.getAllAndOverride<boolean>(
      IS_RENDERNODE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (expectRenderNode) {
      const renderNode =
        await this.nodesService.getRenderNodeByToken(bearerTokenValue);
      if (!renderNode) {
        throw new UnauthorizedException();
      }
      req.user = renderNode;
      const userAgent = context.switchToHttp().getRequest<Request>().headers[
        'user-agent'
      ];
      const versionCode = parseInt(
        /VC (\d+)/.exec(userAgent ?? '')?.[1] ?? '0',
        10,
      );
      if (!versionCode || versionCode < MINIMUM_RENDERNODE_VERSION_CODE) {
        return false;
      }
      return true;
    }

    try {
      const verified = await this.jwtService.verifyAsync<{ sub: string }>(
        bearerTokenValue,
        { maxAge: this.authService.accessTokenLifetimeSeconds },
      );
      if (!verified) {
        throw new UnauthorizedException();
      }
      req.user = { id: parseInt(verified.sub, 10) };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUserId = createParamDecorator(
  (data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req?.user as { id: number } | undefined)?.id;
  },
);

export const IS_RENDERNODE_KEY = 'isRenderNode';
export const ExpectRenderNode = () => SetMetadata(IS_RENDERNODE_KEY, true);

export const CurrentRenderNode = createParamDecorator(
  (data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req?.user as RenderNode;
  },
);
