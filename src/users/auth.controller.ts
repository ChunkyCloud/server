import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserId, Public } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthenticateDto } from './dto/authenticate.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/exchange')
  @Public()
  async getRefreshToken(@Body() body: AuthenticateDto) {
    const user = await this.authService.getUserByAuthCode(body.code);
    if (!user) {
      throw new UnauthorizedException();
    }
    const { accessToken, expiresAt, refreshToken } =
      await this.authService.createRefreshToken(user);
    return {
      refreshToken: {
        expiresAt,
        token: refreshToken,
      },
      accessToken,
    };
  }

  @Post('/refresh')
  @Public()
  async refreshToken(@Body() body: RefreshTokenDto) {
    const tokens = await this.authService.refreshToken(body.refreshToken);
    if (!tokens) {
      throw new UnauthorizedException();
    }
    return {
      refreshToken: {
        expiresAt: tokens.expiresAt,
        token: tokens.refreshToken,
      },
      accessToken: tokens.accessToken,
    };
  }

  @Post('/revoke')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRefreshToken(@Body() body: RefreshTokenDto) {
    const revoked = await this.authService.revokeRefreshToken(
      body.refreshToken,
    );
    if (!revoked) {
      throw new UnauthorizedException();
    }
  }

  @Post('/revoke-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllRefreshTokens(@CurrentUserId() userId: number) {
    await this.authService.revokeAllRefreshTokensByUser(userId);
  }
}
