import { Injectable, ForbiddenException } from '@nestjs/common';
import type { SyncStatePayload, SyncIntentPayload } from '@dimovie/shared';
import { canControlPlayback } from '@dimovie/shared';import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getState(roomCode: string): Promise<SyncStatePayload | null> {
    const cached = await this.redis.getJson<SyncStatePayload>(
      `room:${roomCode}:state`,
    );
    if (cached) return cached;

    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: { playbackState: true },
    });
    if (!room?.playbackState) return null;

    const state: SyncStatePayload = {
      isPlaying: room.playbackState.isPlaying,
      time: room.playbackState.currentTime,
      version: room.playbackState.version,
      serverTs: Date.now(),
      by: room.playbackState.lastEventBy,
      playbackRate: room.playbackState.playbackRate,
    };

    await this.redis.setJson(`room:${roomCode}:state`, state);
    return state;
  }

  async applyIntent(
    roomCode: string,
    userId: string,
    intent: SyncIntentPayload,
  ): Promise<SyncStatePayload> {
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: { playbackState: true },
    });

    if (!room?.playbackState) {
      throw new Error('Room playback state not found');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
    });
    const role =
      participant?.role ??
      (room.ownerId === userId ? 'OWNER' : 'MEMBER');

    if (
      (intent.event === 'PLAY' ||
        intent.event === 'PAUSE' ||
        intent.event === 'SEEK') &&
      !canControlPlayback(role)
    ) {
      throw new ForbiddenException(
        'Join the room to control playback',
      );
    }

    const prev = room.playbackState;    const now = Date.now();
    let currentTime = prev.currentTime;
    let isPlaying = prev.isPlaying;

    if (intent.event === 'PLAY') {
      isPlaying = true;
      currentTime = intent.time;
    } else if (intent.event === 'PAUSE') {
      isPlaying = false;
      currentTime = intent.time;
    } else if (intent.event === 'SEEK') {
      currentTime = intent.time;
    } else if (intent.event === 'TIME_UPDATE') {
      currentTime = intent.time;
    }

    const updated = await this.prisma.playbackState.update({
      where: { roomId: room.id },
      data: {
        isPlaying,
        currentTime,
        version: { increment: 1 },
        lastEventAt: new Date(),
        lastEventBy: userId,
      },
    });

    const state: SyncStatePayload = {
      isPlaying: updated.isPlaying,
      time: updated.currentTime,
      version: updated.version,
      serverTs: now,
      by: userId,
      playbackRate: updated.playbackRate,
    };

    await this.redis.setJson(`room:${roomCode}:state`, state);
    return state;
  }

  async broadcastTimeUpdate(roomCode: string, time: number, isPlaying: boolean) {
    const state: SyncStatePayload = {
      isPlaying,
      time,
      version: 0,
      serverTs: Date.now(),
      by: null,
      playbackRate: 1,
    };
    await this.redis.setJson(`room:${roomCode}:state`, state, 5);
    return { time, serverTs: state.serverTs, isPlaying };
  }
}
