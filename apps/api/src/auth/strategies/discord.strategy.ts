import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { AuthService } from '../auth.service';

@Injectable()
export class DiscordOAuthStrategy extends PassportStrategy(DiscordStrategy, 'discord') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('DISCORD_CLIENT_ID') || 'local-dev-disabled',
      clientSecret: config.get<string>('DISCORD_CLIENT_SECRET') || 'local-dev-disabled',
      callbackURL: config.get<string>(
        'DISCORD_CALLBACK_URL',
        'http://localhost:4000/auth/discord/callback',
      ),
      scope: ['identify', 'email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: {
    id: string;
    email?: string;
    username: string;
    avatar?: string;
  }) {
    const email = profile.email;
    if (!email) return null;
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined;
    return this.authService.findOrCreateOAuthUser({
      provider: 'DISCORD',
      oauthId: profile.id,
      email,
      displayName: profile.username,
      avatarUrl,
    });
  }
}
