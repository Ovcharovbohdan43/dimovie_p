import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { SecurityChallengeStatus } from '@dimovie/shared';
import { CaptchaService } from './captcha.service';
import { TrustScoreService } from './trust-score.service';

@Controller('security')
@UseGuards(ThrottlerGuard)
export class SecurityController {
  constructor(
    private readonly captcha: CaptchaService,
    private readonly trust: TrustScoreService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Clients poll this before sensitive actions. Ordinary users get
   * captchaRequired=false and never see a challenge widget.
   */
  @Get('challenge')
  async challenge(@Req() req: Request): Promise<SecurityChallengeStatus> {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    let subject = `ip:${ip}`;

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : undefined;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
          secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        });
        if (payload.sub) subject = `user:${payload.sub}`;
      } catch {
        /* keep IP subject */
      }
    }

    const trustScore = await this.trust.getScore(subject);
    const captchaRequired = await this.trust.requiresCaptcha(subject);

    return {
      captchaRequired,
      siteKey: captchaRequired ? this.captcha.siteKey : null,
      trustScore,
      reason: captchaRequired ? 'suspicious_activity' : undefined,
    };
  }
}
