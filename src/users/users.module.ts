import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DiscordAuthController } from './discord/discord.controller';
import { DiscordStrategy } from './discord/discord.strategy';
import { AuthCode } from './entities/authCode.entity';
import { AuthIdentity } from './entities/authIdentity.entity';
import { RefreshToken } from './entities/refreshToken.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    TypeOrmModule.forFeature([User, AuthIdentity, AuthCode, RefreshToken]),
  ],
  providers: [
    AuthService,
    DiscordStrategy,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController, DiscordAuthController, UsersController],
})
export class UsersModule {}
