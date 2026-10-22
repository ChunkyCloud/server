import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
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
import { FakeAuthController } from './fake/fake.controller';
import { FakeAuthService } from './fake/fake.service';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';

@Module({
  imports: [
    PassportModule.register({}),
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
    LoginService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  controllers: [AuthController],
})
export class AuthModule {
  static async register(): Promise<DynamicModule> {
    await ConfigModule.envVariablesLoaded;
    const provider = process.env.AUTH_PROVIDER ?? 'discord';
    if (provider === 'fake') {
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('AUTH_PROVIDER=fake requires NODE_ENV=development');
      }
      return {
        module: AuthModule,
        providers: [FakeAuthService],
        controllers: [FakeAuthController],
      };
    }
    if (provider !== 'discord') {
      throw new Error(`Unsupported AUTH_PROVIDER: ${provider}`);
    }
    return {
      module: AuthModule,
      providers: [DiscordStrategy],
      controllers: [LoginController, DiscordAuthController],
    };
  }
}
