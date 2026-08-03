import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(GoogleStrategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'local-dev-disabled',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'local-dev-disabled',
      callbackURL: config.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:4000/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value;
    if (!email) return null;
    return this.authService.findOrCreateOAuthUser({
      provider: 'GOOGLE',
      oauthId: profile.id,
      email,
      displayName: profile.displayName || email.split('@')[0]!,
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
