import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import type { ChatMessagePayload, ChatSendResult } from '@dimovie/shared';
import {
  CHAT_MAX_LENGTH,
  CHAT_MIN_INTERVAL_MS,
  CHAT_SHADOW_BAN_SEC,
  CHAT_SHADOW_VIOLATIONS,
  CHAT_VIOLATIONS_WINDOW_SEC,
} from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ChatService {
  private readonly RECENT_LIMIT = 100;
  /** Max delivered messages per minute (≈ one every 5s). */
  private readonly CHAT_LIMIT = Math.floor(60_000 / CHAT_MIN_INTERVAL_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly analytics: AnalyticsService,
  ) {}

  async sendMessage(
    roomId: string,
    roomCode: string,
    userId: string,
    displayName: string,
    content: string,
  ): Promise<ChatSendResult> {
    const sanitized = sanitizeHtml(content.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    });

    if (!sanitized) {
      throw new HttpException('Empty message', HttpStatus.BAD_REQUEST);
    }

    if (sanitized.length > CHAT_MAX_LENGTH) {
      throw new HttpException(
        `Message is too long (max ${CHAT_MAX_LENGTH} characters)`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = Date.now();
    const shadowKey = `chat:shadow:${userId}`;
    const isShadowBanned = (await this.redis.client.exists(shadowKey)) === 1;

    if (isShadowBanned) {
      return {
        kind: 'shadow',
        message: this.buildShadowMessage(
          roomId,
          userId,
          displayName,
          sanitized,
        ),
      };
    }

    const lastKey = `chat:last:${userId}`;
    const lastRaw = await this.redis.client.get(lastKey);
    const lastSentMs = lastRaw ? Number(lastRaw) : 0;
    const elapsed = lastSentMs > 0 ? now - lastSentMs : CHAT_MIN_INTERVAL_MS;

    if (elapsed < CHAT_MIN_INTERVAL_MS) {
      const violKey = `chat:violations:${userId}`;
      const violations = await this.redis.incrWithExpire(
        violKey,
        CHAT_VIOLATIONS_WINDOW_SEC,
      );

      if (violations >= CHAT_SHADOW_VIOLATIONS) {
        await this.redis.client.set(shadowKey, '1', 'EX', CHAT_SHADOW_BAN_SEC);
        return {
          kind: 'shadow',
          message: this.buildShadowMessage(
            roomId,
            userId,
            displayName,
            sanitized,
          ),
        };
      }

      const waitSeconds = Math.max(
        1,
        Math.ceil((CHAT_MIN_INTERVAL_MS - elapsed) / 1000),
      );
      return { kind: 'cooldown', waitSeconds };
    }

    const rateKey = `ratelimit:chat:${userId}`;
    const count = await this.redis.incrWithExpire(rateKey, 60);
    if (count > this.CHAT_LIMIT) {
      await this.redis.client.set(shadowKey, '1', 'EX', CHAT_SHADOW_BAN_SEC);
      return {
        kind: 'shadow',
        message: this.buildShadowMessage(
          roomId,
          userId,
          displayName,
          sanitized,
        ),
      };
    }

    const message = await this.prisma.message.create({
      data: { roomId, userId, content: sanitized },
    });

    const payload: ChatMessagePayload = {
      id: message.id,
      roomId,
      userId,
      displayName,
      content: sanitized,
      createdAt: message.createdAt.toISOString(),
    };

    const listKey = `room:${roomCode}:chat:recent`;
    await this.redis.client.lpush(listKey, JSON.stringify(payload));
    await this.redis.client.ltrim(listKey, 0, this.RECENT_LIMIT - 1);

    await this.redis.client.set(lastKey, String(now), 'EX', 3600);
    await this.redis.client.del(`chat:violations:${userId}`);

    void this.analytics.incrementSessionMessages(roomId);

    return { kind: 'broadcast', message: payload };
  }

  private buildShadowMessage(
    roomId: string,
    userId: string,
    displayName: string,
    content: string,
  ): ChatMessagePayload {
    return {
      id: `shadow-${randomUUID()}`,
      roomId,
      userId,
      displayName,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  async getRecent(roomCode: string): Promise<ChatMessagePayload[]> {
    const listKey = `room:${roomCode}:chat:recent`;
    const items = await this.redis.client.lrange(listKey, 0, this.RECENT_LIMIT - 1);
    if (items.length > 0) {
      return items.map((i) => JSON.parse(i) as ChatMessagePayload).reverse();
    }

    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: this.RECENT_LIMIT,
          include: { user: { select: { displayName: true } } },
        },
      },
    });

    if (!room) return [];

    return room.messages.reverse().map((m) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.userId,
      displayName: m.user.displayName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async deleteMessage(messageId: string, roomId: string, requesterId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return null;
    if (room.ownerId !== requesterId) return null;

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { messageId, roomId };
  }
}
