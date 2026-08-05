import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ROOM_INACTIVE_CLEANUP_DAYS } from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TrustScoreService } from './trust-score.service';

/**
 * Background worker: trust-score recovery + inactive room cleanup.
 * Mirrors how large platforms run lightweight periodic hygiene jobs
 * in-process (or as a dedicated worker replica with the same cron).
 */
@Injectable()
export class SecurityWorker {
  private readonly logger = new Logger(SecurityWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trust: TrustScoreService,
  ) {}

  /** Every 15 minutes: gently restore trust for recovering subjects. */
  @Cron('*/15 * * * *')
  async decayTrustScores() {
    try {
      const keys = await this.scanKeys('trust:score:*', 200);
      let restored = 0;
      for (const key of keys) {
        const subject = key.replace(/^trust:score:/, '');
        if (!subject) continue;
        const before = await this.trust.getScore(subject);
        if (before >= 100) continue;
        await this.trust.decayTowardDefault(subject, 3);
        restored += 1;
      }
      if (restored > 0) {
        this.logger.log(`Trust decay restored ${restored} subjects`);
      }
    } catch (err) {
      this.logger.warn(
        `Trust decay failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  /**
   * Every 6 hours: permanently remove ACTIVE rooms idle for 7+ days
   * with zero live presence.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async cleanupInactiveRooms() {
    const cutoff = new Date(
      Date.now() - ROOM_INACTIVE_CLEANUP_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const candidates = await this.prisma.room.findMany({
        where: {
          status: 'ACTIVE',
          lastActivityAt: { lt: cutoff },
        },
        select: { id: true, roomCode: true, lastActivityAt: true },
        take: 100,
      });

      let removed = 0;
      for (const room of candidates) {
        const presenceKey = `room:${room.roomCode}:presence`;
        const online = await this.redis.client.hlen(presenceKey);
        if (online > 0) continue;

        await this.prisma.room.delete({ where: { id: room.id } });
        await this.redis.client.del(
          `room:${room.roomCode}:state`,
          `room:${room.roomCode}:presence`,
          `room:${room.roomCode}:chat:recent`,
        );
        removed += 1;
      }

      if (removed > 0) {
        this.logger.log(
          `Cleaned ${removed} inactive rooms (idle > ${ROOM_INACTIVE_CLEANUP_DAYS}d)`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Room cleanup failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async scanKeys(pattern: string, limit: number): Promise<string[]> {
    const out: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        50,
      );
      cursor = next;
      for (const key of keys) {
        out.push(key);
        if (out.length >= limit) return out;
      }
    } while (cursor !== '0');
    return out;
  }
}
