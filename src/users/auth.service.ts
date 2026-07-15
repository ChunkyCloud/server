import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import { AuthCode } from './entities/authCode.entity';
import { AuthIdentity } from './entities/authIdentity.entity';
import { RefreshToken } from './entities/refreshToken.entity';
import { User } from './entities/user.entity';

const authCodeLifetimeSeconds = 60;
const refreshTokenLifetimeSeconds = 30 * 24 * 60 * 60; // 30 days
const accessTokenLifetimeSeconds = 15 * 60; // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthIdentity)
    private readonly authIdentities: Repository<AuthIdentity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AuthCode)
    private readonly authCodes: Repository<AuthCode>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  async upsertUser(
    userInfo: {
      displayName: string;
      avatarUrl: string | null;
    },
    authIdentity: {
      provider: string;
      providerUserId: string;
    },
  ) {
    const identity = await this.authIdentities.findOne({
      where: {
        provider: authIdentity.provider,
        providerUserId: authIdentity.providerUserId,
      },
      relations: { user: true },
    });
    if (identity) {
      if (
        identity.user.displayName !== userInfo.displayName ||
        identity.user.avatarUrl !== userInfo.avatarUrl
      ) {
        const update = {
          displayName: userInfo.displayName,
          avatarUrl: userInfo.avatarUrl,
        };
        await this.users.update(identity.user.id, update);
        identity.user = { ...identity.user, ...update };
      }
      return identity.user;
    }

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        displayName: userInfo.displayName,
      });
      await manager.save(user);

      await manager.insert(AuthIdentity, {
        provider: authIdentity.provider,
        providerUserId: authIdentity.providerUserId,
        user: { id: user.id },
      });

      return user;
    });
  }

  async createAuthCode(user: User): Promise<string> {
    const code = randomUUID();
    await this.authCodes.insert({
      codeHash: createHash('sha256').update(code).digest('hex'),
      expiresAt: new Date(Date.now() + authCodeLifetimeSeconds * 1000),
      user: { id: user.id },
    });
    return code;
  }

  async getUserByAuthCode(code: string): Promise<User | null> {
    const now = new Date();
    const codeHash = createHash('sha256').update(code).digest('hex');
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager.update(
        AuthCode,
        { codeHash, usedAt: IsNull(), expiresAt: MoreThan(now) },
        {
          usedAt: now,
        },
      );
      if (updateResult.affected !== 1) {
        return null;
      }
      const authCode = await manager.findOne(AuthCode, {
        where: { codeHash },
        relations: {
          user: true,
        },
      });
      return authCode?.user ?? null;
    });
  }

  async createRefreshToken(user: User) {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshTokenHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + refreshTokenLifetimeSeconds * 1000,
    );
    await this.refreshTokens.insert({
      user: { id: user.id },
      tokenHash: refreshTokenHash,
      createdAt: now,
      expiresAt,
    });
    return {
      refreshToken,
      expiresAt,
      accessToken: await this.createAccessToken(user, now),
    };
  }

  async refreshToken(refreshToken: string) {
    const newRefreshToken = randomBytes(32).toString('base64url');
    const newRefreshTokenHash = createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + refreshTokenLifetimeSeconds * 1000,
    ); // now + 30 days
    const updateResult = await this.refreshTokens.update(
      {
        revokedAt: IsNull(),
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      },
      {
        expiresAt,
        tokenHash: newRefreshTokenHash,
      },
    );
    if (updateResult.affected !== 1) {
      return null;
    }
    const refreshTokenEntity = await this.refreshTokens.findOne({
      where: { tokenHash: newRefreshTokenHash },
      relations: { user: true },
    });
    if (!refreshTokenEntity) {
      return null;
    }
    return {
      refreshToken: newRefreshToken,
      expiresAt,
      accessToken: await this.createAccessToken(refreshTokenEntity.user, now),
    };
  }

  private createAccessToken(user: User, createdAt: Date) {
    return this.jwtService.signAsync({
      sub: user.id,
      iat: Math.floor(createdAt.getTime() / 1000),
      exp: Math.floor(createdAt.getTime() / 1000) + accessTokenLifetimeSeconds,
    });
  }

  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    const updateResult = await this.refreshTokens.update(
      {
        revokedAt: IsNull(),
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      },
      {
        revokedAt: new Date(),
      },
    );
    return updateResult.affected === 1;
  }

  async revokeAllRefreshTokensByUser(userId: number) {
    await this.refreshTokens.update(
      {
        revokedAt: IsNull(),
        user: { id: userId },
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  get accessTokenLifetimeSeconds() {
    return accessTokenLifetimeSeconds;
  }
}
