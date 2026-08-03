import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { WS_ROOM_EVENTS } from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface RemoveUserPayload {
  action: 'kicked' | 'banned';
  message: string;
}

@Injectable()
export class RoomPresenceService {
  private readonly logger = new Logger(RoomPresenceService.name);
  private server: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  async removeUserFromRooms(
    roomCodes: string[],
    userId: string,
    payload: RemoveUserPayload,
  ) {
    for (const roomCode of roomCodes) {
      await this.removeUserFromRoom(roomCode, userId, payload);
    }
  }

  async removeUserFromRoom(
    roomCode: string,
    userId: string,
    payload: RemoveUserPayload,
  ) {
    if (!this.server) {
      this.logger.warn('Socket server not ready — skip realtime removal');
      return;
    }

    const presenceKey = `room:${roomCode}:presence`;
    const entries = await this.redis.client.hgetall(presenceKey);

    for (const [socketId, uid] of Object.entries(entries)) {
      if (uid !== userId) continue;

      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(WS_ROOM_EVENTS.REMOVED, payload);
        socket.disconnect(true);
      }
      await this.redis.client.hdel(presenceKey, socketId);
    }

    await this.broadcastParticipants(roomCode);
  }

  async closeRoom(roomCode: string, message: string) {
    if (!this.server) {
      this.logger.warn('Socket server not ready — skip room close broadcast');
      return;
    }

    const payload = { message };
    this.server.to(`room:${roomCode}`).emit(WS_ROOM_EVENTS.CLOSED, payload);

    const presenceKey = `room:${roomCode}:presence`;
    const entries = await this.redis.client.hgetall(presenceKey);

    for (const socketId of Object.keys(entries)) {
      const socket = this.server.sockets.sockets.get(socketId);
      socket?.emit(WS_ROOM_EVENTS.CLOSED, payload);
      socket?.disconnect(true);
    }

    await this.redis.client.del(presenceKey);
  }

  async broadcastParticipants(roomCode: string) {
    if (!this.server) return;

    const participants = await this.getParticipants(roomCode);
    this.server
      .to(`room:${roomCode}`)
      .emit(WS_ROOM_EVENTS.PARTICIPANTS, participants);
  }

  private async getParticipants(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: {
        participants: {
          include: { user: { select: { id: true, displayName: true } } },
        },
      },
    });

    return (
      room?.participants.map((p) => ({
        userId: p.user.id,
        displayName: p.user.displayName,
        role: p.role,
      })) ?? []
    );
  }
}
