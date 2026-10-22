import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class FakeAuthService {
  constructor(private readonly authService: AuthService) {}

  async authenticate(username: string) {
    if (!username) {
      throw new UnauthorizedException();
    }

    return this.authService.upsertUser(
      { displayName: username, avatarUrl: null },
      { provider: 'fake', providerUserId: username },
    );
  }
}
