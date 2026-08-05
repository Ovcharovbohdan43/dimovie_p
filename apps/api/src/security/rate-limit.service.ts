import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  SECURITY_ERROR_CODES,
  ROOM_CREATE_LIMIT,
  ROOM_CREATE_WINDOW_SEC,
  CHAT_BURST_LIMIT,
  CHAT_BURST_WINDOW_SEC,
  AUTH_LOGIN_LIMIT,
  AUTH_LOGIN_WINDOW_SEC,
  AUTH_REGISTER_LIMIT,
  AUTH_REGISTER_WINDOW_SEC,
  WS_MAX_EVENTS_PER_SEC,
} from '@dimovie/shared';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Fixed-window counter with TTL. Returns current count after increment.
   */
  async hit(key: string, limit: number, windowSec: number): Promise<{
    allowed: boolean;
    count: number;
    retryAfterSec: number;
  }> {
    const count = await this.redis.incrWithExpire(key, windowSec);
    const ttl = await this.redis.client.ttl(key);
    const retryAfterSec = ttl > 0 ? ttl : windowSec;
    return {
      allowed: count <= limit,
      count,
      retryAfterSec,
    };
  }

  assertAllowed(
    result: { allowed: boolean; retryAfterSec: number },
    message = 'Too many requests. Slow down and try again.',
  ) {
    if (result.allowed) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        code: SECURITY_ERROR_CODES.RATE_LIMITED,
        retryAfterSec: result.retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async consumeRoomCreate(userId: string) {
    const result = await this.hit(
      `ratelimit:room:create:${userId}`,
      ROOM_CREATE_LIMIT,
      ROOM_CREATE_WINDOW_SEC,
    );
    this.assertAllowed(
      result,
      `Room create limit reached (${ROOM_CREATE_LIMIT}/min). Try again shortly.`,
    );
    return result;
  }

  async consumeChatBurst(userId: string) {
    return this.hit(
      `ratelimit:chat:burst:${userId}`,
      CHAT_BURST_LIMIT,
      CHAT_BURST_WINDOW_SEC,
    );
  }

  async consumeLogin(ip: string) {
    const result = await this.hit(
      `ratelimit:auth:login:${ip}`,
      AUTH_LOGIN_LIMIT,
      AUTH_LOGIN_WINDOW_SEC,
    );
    this.assertAllowed(
      result,
      'Too many sign-in attempts. Wait a bit, then try again.',
    );
    return result;
  }

  async clearLogin(ip: string) {
    await this.redis.client.del(`ratelimit:auth:login:${ip}`);
  }

  async consumeRegister(ip: string) {
    const result = await this.hit(
      `ratelimit:auth:register:${ip}`,
      AUTH_REGISTER_LIMIT,
      AUTH_REGISTER_WINDOW_SEC,
    );
    this.assertAllowed(
      result,
      'Too many registration attempts. Wait a minute, then try again.',
    );
    return result;
  }

  /** Sliding per-second event gate for WebSocket handlers (in-memory via Redis). */
  async consumeWsEvent(socketId: string): Promise<boolean> {
    const result = await this.hit(
      `ratelimit:ws:evt:${socketId}`,
      WS_MAX_EVENTS_PER_SEC,
      1,
    );
    return result.allowed;
  }

  async consumeWsConnect(ip: string, limit: number, windowSec = 60) {
    return this.hit(`ratelimit:ws:conn:${ip}`, limit, windowSec);
  }
}
