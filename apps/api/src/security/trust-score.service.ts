import { Injectable, Logger } from '@nestjs/common';
import {
  TRUST_SCORE_DEFAULT,
  TRUST_SCORE_CAPTCHA,
  TRUST_SCORE_SOFT_BLOCK,
} from '@dimovie/shared';
import { RedisService } from '../redis/redis.service';

export type TrustSignal =
  | 'room_create'
  | 'chat_burst'
  | 'ws_connect'
  | 'auth_fail'
  | 'auth_ok'
  | 'captcha_pass'
  | 'captcha_fail'
  | 'regular_interval'
  | 'guest_join';

const SIGNAL_WEIGHT: Record<TrustSignal, number> = {
  room_create: -4,
  chat_burst: -8,
  ws_connect: -2,
  auth_fail: -6,
  auth_ok: 2,
  captcha_pass: 15,
  captcha_fail: -12,
  regular_interval: -10,
  guest_join: -1,
};

const SCORE_TTL_SEC = 7 * 24 * 60 * 60;
const TIMING_TTL_SEC = 300;

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(private readonly redis: RedisService) {}

  private scoreKey(subject: string) {
    return `trust:score:${subject}`;
  }

  private timingKey(subject: string, action: string) {
    return `trust:timing:${subject}:${action}`;
  }

  async getScore(subject: string): Promise<number> {
    const raw = await this.redis.client.get(this.scoreKey(subject));
    if (raw == null) return TRUST_SCORE_DEFAULT;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : TRUST_SCORE_DEFAULT;
  }

  async record(
    subject: string,
    signal: TrustSignal,
    meta?: { intervalMs?: number },
  ): Promise<number> {
    let delta = SIGNAL_WEIGHT[signal] ?? 0;

    if (meta?.intervalMs != null && meta.intervalMs > 0) {
      const timingKey = this.timingKey(subject, signal);
      const prev = await this.redis.client.get(timingKey);
      await this.redis.client.set(
        timingKey,
        String(meta.intervalMs),
        'EX',
        TIMING_TTL_SEC,
      );
      if (prev) {
        const prevMs = Number(prev);
        const drift = Math.abs(prevMs - meta.intervalMs);
        if (drift < 40 && meta.intervalMs < 2000) {
          delta += SIGNAL_WEIGHT.regular_interval;
        }
      }
    }

    const key = this.scoreKey(subject);
    const current = await this.getScore(subject);
    const next = Math.min(100, Math.max(0, current + delta));
    await this.redis.client.set(key, String(next), 'EX', SCORE_TTL_SEC);

    if (next <= TRUST_SCORE_CAPTCHA) {
      this.logger.debug(
        `trust low subject=${subject} score=${next} signal=${signal}`,
      );
    }
    return next;
  }

  async requiresCaptcha(subject: string): Promise<boolean> {
    return (await this.getScore(subject)) <= TRUST_SCORE_CAPTCHA;
  }

  async isSoftBlocked(subject: string): Promise<boolean> {
    return (await this.getScore(subject)) <= TRUST_SCORE_SOFT_BLOCK;
  }

  async decayTowardDefault(subject: string, step = 2): Promise<number> {
    const current = await this.getScore(subject);
    if (current >= TRUST_SCORE_DEFAULT) return current;
    const next = Math.min(TRUST_SCORE_DEFAULT, current + step);
    await this.redis.client.set(
      this.scoreKey(subject),
      String(next),
      'EX',
      SCORE_TTL_SEC,
    );
    return next;
  }
}
