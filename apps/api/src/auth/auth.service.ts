import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { AuthResponse, AuthUser } from '@dimovie/shared';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto, res: Response): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName.trim(),
      },
    });

    return this.issueTokens(user, res);
  }

  async login(dto: LoginDto, res: Response, ip: string): Promise<AuthResponse> {
    const rateKey = `ratelimit:auth:${ip}`;
    const attempts = await this.redis.incrWithExpire(rateKey, 900);
    if (attempts > 5) {
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.redis.client.del(rateKey);
    return this.issueTokens(user, res);
  }

  async findOrCreateOAuthUser(data: {
    provider: 'GOOGLE' | 'DISCORD';
    oauthId: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  }) {
    const email = data.email.toLowerCase();

    const byOAuth = await this.prisma.user.findFirst({
      where: { oauthProvider: data.provider, oauthId: data.oauthId },
    });
    if (byOAuth) return byOAuth;

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          oauthProvider: data.provider,
          oauthId: data.oauthId,
          avatarUrl: byEmail.avatarUrl ?? data.avatarUrl,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        oauthProvider: data.provider,
        oauthId: data.oauthId,
      },
    });
  }

  issueOAuthTokens(
    user: { id: string; email: string; displayName: string },
    res: Response,
  ) {
    return this.issueTokens(user, res);
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.user, res);
  }

  async logout(refreshToken: string | undefined, res: Response) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    this.clearRefreshCookie(res);
    return { success: true };
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return this.toAuthUser(user);
  }

  private async issueTokens(
    user: { id: string; email: string; displayName: string },
    res: Response,
  ): Promise<AuthResponse> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshDays = parseInt(
      this.config.get<string>('JWT_REFRESH_TTL', '30d').replace('d', ''),
      10,
    );

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    this.setRefreshCookie(res, refreshToken, expiresAt);

    return {
      user: this.toAuthUser(user),
      accessToken,
      expiresIn: this.parseTtlSeconds(accessTtl),
    };
  }

  private refreshCookieOptions(expiresAt?: Date) {
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    const isProd = this.config.get('NODE_ENV') === 'production';
    // path '/' so cookie works both on direct API and via Next `/backend` rewrite
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      ...(expiresAt ? { expires: expiresAt } : {}),
      ...(domain ? { domain } : {}),
    };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('refreshToken', token, this.refreshCookieOptions(expiresAt));
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie('refreshToken', this.refreshCookieOptions());
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    displayName: string;
    subscription?: 'FREE' | 'PRO' | 'ENTERPRISE';
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      subscription: user.subscription ?? 'FREE',
    };
  }

  private parseTtlSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 60);
  }
}
