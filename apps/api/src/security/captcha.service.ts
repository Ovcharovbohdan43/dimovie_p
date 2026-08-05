import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SECURITY_ERROR_CODES } from '@dimovie/shared';
import { TrustScoreService } from './trust-score.service';

/**
 * Cloudflare Turnstile verification (invisible / managed challenge).
 * When secret is unset, challenges soft-fail open in development and
 * fall back to temporary soft-blocks in production.
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly trust: TrustScoreService,
  ) {}

  get siteKey(): string | null {
    return this.config.get<string>('TURNSTILE_SITE_KEY')?.trim() || null;
  }

  get secretKey(): string | null {
    return this.config.get<string>('TURNSTILE_SECRET_KEY')?.trim() || null;
  }

  get isConfigured(): boolean {
    return Boolean(this.siteKey && this.secretKey);
  }

  async assertCaptchaIfNeeded(opts: {
    subject: string;
    captchaToken?: string;
    ip?: string;
    actionLabel?: string;
  }) {
    const needs = await this.trust.requiresCaptcha(opts.subject);
    if (!needs) return;

    if (await this.trust.isSoftBlocked(opts.subject) && !opts.captchaToken) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Unusual activity detected. Complete the security check, then try again.',
          code: SECURITY_ERROR_CODES.TRUST_BLOCKED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.isConfigured) {
      this.logger.warn(
        `CAPTCHA required for ${opts.subject} but Turnstile is not configured`,
      );
      // Without Turnstile keys, enforce a harder rate-style block instead of open bypass.
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Unusual activity detected. Wait a few minutes before trying again.',
          code: SECURITY_ERROR_CODES.TRUST_BLOCKED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!opts.captchaToken) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Security check required',
          code: SECURITY_ERROR_CODES.CAPTCHA_REQUIRED,
          siteKey: this.siteKey,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const ok = await this.verify(opts.captchaToken, opts.ip);
    if (!ok) {
      await this.trust.record(opts.subject, 'captcha_fail');
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Security check failed. Try again.',
          code: SECURITY_ERROR_CODES.CAPTCHA_REQUIRED,
          siteKey: this.siteKey,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.trust.record(opts.subject, 'captcha_pass');
  }

  async verify(token: string, ip?: string): Promise<boolean> {
    const secret = this.secretKey;
    if (!secret) return false;

    try {
      const body = new URLSearchParams();
      body.set('secret', secret);
      body.set('response', token);
      if (ip) body.set('remoteip', ip);

      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );
      if (!res.ok) return false;
      const data = (await res.json()) as { success?: boolean };
      return Boolean(data.success);
    } catch (err) {
      this.logger.warn(
        `Turnstile verify error: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return false;
    }
  }
}
