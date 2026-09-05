import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodesModule } from '../nodes/nodes.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DiscordAuthController } from './discord/discord.controller';
import { DiscordStrategy } from './discord/discord.strategy';
import { AuthCode } from './entities/authCode.entity';
import { AuthIdentity } from './entities/authIdentity.entity';
import { RefreshToken } from './entities/refreshToken.entity';
import { User } from './entities/user.entity';
import { UsersModule } from './users.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    TypeOrmModule.forFeature([AuthIdentity, AuthCode, RefreshToken, User]),
    UsersModule,
    NodesModule,
  ],
  providers: [
    AuthService,
    DiscordStrategy,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController, DiscordAuthController],
})
export class AuthModule {}
