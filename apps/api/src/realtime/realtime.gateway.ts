import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  WS_ROOM_EVENTS,
  SECURITY_ERROR_CODES,
  WS_MAX_CONNECTIONS_PER_IP,
  WS_MAX_CONNECTIONS_PER_USER,
  WS_GUEST_MAX_PER_IP,
} from '@dimovie/shared';
import type { SyncIntentPayload } from '@dimovie/shared';
import { WsAuthService, type RoomSocket } from './ws-auth.service';
import { SyncService } from './sync.service';
import { ChatService } from './chat.service';
import { RoomPresenceService } from './room-presence.service';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RateLimitService } from '../security/rate-limit.service';
import { TrustScoreService } from '../security/trust-score.service';
import { getCorsOptions } from '../common/cors';
import * as argon2 from 'argon2';

@WebSocketGateway({
  cors: getCorsOptions(),
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly lastTypingAt = new Map<string, number>();

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly syncService: SyncService,
    private readonly chatService: ChatService,
    private readonly presence: RoomPresenceService,
    private readonly moderation: ModerationService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly analytics: AnalyticsService,
    private readonly rateLimit: RateLimitService,
    private readonly trust: TrustScoreService,
  ) {}

  afterInit(server: Server) {
    this.presence.setServer(server);
  }

  async handleConnection(client: RoomSocket) {
    const ip =
      (client.handshake.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      client.handshake.address ||
      'unknown';

    const conn = await this.rateLimit.consumeWsConnect(
      ip,
      WS_MAX_CONNECTIONS_PER_IP,
      60,
    );
    if (!conn.allowed) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Too many connections from this network',
        code: SECURITY_ERROR_CODES.RATE_LIMITED,
      });
      client.disconnect(true);
      return;
    }

    const user = await this.wsAuth.tryAuthenticate(client);
    if (user) {
      const userConn = await this.rateLimit.hit(
        `ratelimit:ws:user:${user.id}`,
        WS_MAX_CONNECTIONS_PER_USER,
        60,
      );
      if (!userConn.allowed) {
        client.emit(WS_ROOM_EVENTS.ERROR, {
          message: 'Too many open sessions',
          code: SECURITY_ERROR_CODES.RATE_LIMITED,
        });
        client.disconnect(true);
        return;
      }

      client.user = user;
      client.isGuest = false;
      client.data.userId = user.id;
      await this.trust.record(`user:${user.id}`, 'ws_connect');
      this.logger.log(`ws connected user=${user.id}`);
      return;
    }

    const guestConn = await this.rateLimit.hit(
      `ratelimit:ws:guest:${ip}`,
      WS_GUEST_MAX_PER_IP,
      60,
    );
    if (!guestConn.allowed) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Too many guest connections',
        code: SECURITY_ERROR_CODES.RATE_LIMITED,
      });
      client.disconnect(true);
      return;
    }

    client.isGuest = true;
    client.guestId = `guest:${client.id}`;
    client.data.userId = client.guestId;
    await this.trust.record(`ip:${ip}`, 'guest_join');
    this.logger.log(`ws connected guest=${client.guestId}`);
  }

  async handleDisconnect(client: RoomSocket) {
    if (client.roomCode) {
      await this.leaveRoom(client, client.roomCode);
    }
  }

  private async guardEvent(client: RoomSocket): Promise<boolean> {
    const ok = await this.rateLimit.consumeWsEvent(client.id);
    if (!ok) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Too many events',
        code: SECURITY_ERROR_CODES.RATE_LIMITED,
      });
      return false;
    }
    return true;
  }

  private requireMember(client: RoomSocket): boolean {
    if (client.isGuest || !client.user) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Sign in to interact',
        code: SECURITY_ERROR_CODES.GUEST_FORBIDDEN,
        scope: 'auth',
      });
      return false;
    }
    return true;
  }

  @SubscribeMessage(WS_ROOM_EVENTS.JOIN)
  async onJoin(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { roomCode: string; password?: string },
  ) {
    if (!(await this.guardEvent(client))) return;

    const roomCode = body.roomCode?.toUpperCase?.();
    if (!roomCode) {
      client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }

    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: { participants: true, owner: true },
    });

    if (!room || room.status !== 'ACTIVE') {
      client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }

    // Guest path — watch-only, no Participant row.
    if (client.isGuest || !client.user) {
      if (room.privacy === 'PASSWORD') {
        if (!body.password || !room.passwordHash) {
          client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Password required' });
          return;
        }
        const valid = await argon2.verify(room.passwordHash, body.password);
        if (!valid) {
          client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Invalid password' });
          return;
        }
      }

      if (client.roomCode) {
        await this.leaveRoom(client, client.roomCode);
      }

      client.roomCode = roomCode;
      await client.join(`room:${roomCode}`);

      const presenceKey = `room:${roomCode}:presence`;
      await this.redis.client.hset(
        presenceKey,
        client.id,
        client.guestId ?? `guest:${client.id}`,
      );
      await this.redis.client.expire(presenceKey, 120);

      const participants = await this.getParticipants(roomCode);
      const syncState = await this.syncService.getState(roomCode);
      const recentChat = await this.chatService.getRecent(roomCode);

      client.emit(WS_ROOM_EVENTS.JOINED, {
        roomCode,
        syncState,
        recentChat,
        participants,
        mode: 'guest',
      });

      await this.prisma.room.update({
        where: { id: room.id },
        data: { lastActivityAt: new Date() },
      });
      return;
    }

    const access = await this.moderation.canJoinRoom(
      room.id,
      room.ownerId,
      client.user.id,
    );
    if (!access.allowed) {
      client.emit(WS_ROOM_EVENTS.ERROR, { message: access.reason });
      return;
    }

    const isParticipant = room.participants.some(
      (p) => p.userId === client.user!.id,
    );

    if (!isParticipant) {
      if (room.privacy === 'PUBLIC' || room.privacy === 'PRIVATE') {
        await this.prisma.participant.create({
          data: { roomId: room.id, userId: client.user.id },
        });
      } else if (room.privacy === 'PASSWORD') {
        if (!body.password || !room.passwordHash) {
          client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Not a participant' });
          return;
        }
        const valid = await argon2.verify(room.passwordHash, body.password);
        if (!valid) {
          client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Invalid password' });
          return;
        }
        await this.prisma.participant.create({
          data: { roomId: room.id, userId: client.user.id },
        });
      } else {
        client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Not a participant' });
        return;
      }
    }

    if (client.roomCode) {
      await this.leaveRoom(client, client.roomCode);
    }

    client.roomCode = roomCode;
    await client.join(`room:${roomCode}`);
    this.logger.log(`ws join room=${roomCode} user=${client.user.id}`);

    const presenceKey = `room:${roomCode}:presence`;
    await this.redis.client.hset(presenceKey, client.id, client.user.id);
    await this.redis.client.expire(presenceKey, 120);

    const participants = await this.getParticipants(roomCode);
    const syncState = await this.syncService.getState(roomCode);
    const recentChat = await this.chatService.getRecent(roomCode);

    client.emit(WS_ROOM_EVENTS.JOINED, {
      roomCode,
      syncState,
      recentChat,
      participants,
      mode: 'member',
    });

    client.to(`room:${roomCode}`).emit(WS_ROOM_EVENTS.PARTICIPANTS, participants);

    void this.analytics.updateSessionPeak(room.id, participants.length);
    await this.prisma.room.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date() },
    });
  }

  @SubscribeMessage(WS_ROOM_EVENTS.LEAVE)
  async onLeave(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { roomCode: string },
  ) {
    if (!(await this.guardEvent(client))) return;
    await this.leaveRoom(client, body.roomCode.toUpperCase());
  }

  @SubscribeMessage(WS_ROOM_EVENTS.SYNC_INTENT)
  async onSyncIntent(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() intent: SyncIntentPayload,
  ) {
    if (!(await this.guardEvent(client))) return;
    if (!this.requireMember(client)) return;
    if (!client.roomCode || !client.user) return;

    try {
      const state = await this.syncService.applyIntent(
        client.roomCode,
        client.user.id,
        intent,
      );

      const room = await this.prisma.room.findUnique({
        where: { roomCode: client.roomCode },
        select: { id: true },
      });
      if (room) {
        await this.prisma.room.update({
          where: { id: room.id },
          data: { lastActivityAt: new Date() },
        });
      }

      this.server
        .in(`room:${client.roomCode}`)
        .emit(WS_ROOM_EVENTS.SYNC_STATE, state);
    } catch (err) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message:
          err instanceof Error ? err.message : 'Playback control not allowed',
        scope: 'sync',
      });
    }
  }

  @SubscribeMessage(WS_ROOM_EVENTS.CHAT_MESSAGE)
  async onChatMessage(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { content: string },
  ) {
    if (!(await this.guardEvent(client))) return;
    if (!this.requireMember(client)) return;
    if (!client.roomCode || !client.user) {
      this.logger.warn(
        `chat:message dropped — socket not in a room user=${client.user?.id}`,
      );
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Not connected to the room yet',
        scope: 'chat',
      });
      return;
    }

    const room = await this.prisma.room.findUnique({
      where: { roomCode: client.roomCode },
    });
    if (!room) return;

    try {
      const result = await this.chatService.sendMessage(
        room.id,
        client.roomCode,
        client.user.id,
        client.user.displayName,
        body.content,
      );

      switch (result.kind) {
        case 'broadcast':
          client.emit(WS_ROOM_EVENTS.CHAT_MESSAGE, result.message);
          client
            .to(`room:${client.roomCode}`)
            .emit(WS_ROOM_EVENTS.CHAT_MESSAGE, result.message);
          break;
        case 'shadow':
          client.emit(WS_ROOM_EVENTS.CHAT_MESSAGE, result.message);
          break;
        case 'cooldown':
          client.emit(WS_ROOM_EVENTS.CHAT_COOLDOWN, {
            waitSeconds: result.waitSeconds,
          });
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chat error';
      this.logger.warn(
        `chat:message failed room=${client.roomCode} user=${client.user?.id}: ${message}`,
      );
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message,
        scope: 'chat',
      });
    }
  }

  @SubscribeMessage(WS_ROOM_EVENTS.CHAT_TYPING)
  async onChatTyping(@ConnectedSocket() client: RoomSocket) {
    if (!(await this.guardEvent(client))) return;
    if (!this.requireMember(client)) return;
    if (!client.roomCode || !client.user) return;
    const key = `${client.roomCode}:${client.user.id}`;
    const now = Date.now();
    const last = this.lastTypingAt.get(key) ?? 0;
    if (now - last < 1000) return;
    this.lastTypingAt.set(key, now);

    client.to(`room:${client.roomCode}`).emit(WS_ROOM_EVENTS.CHAT_TYPING, {
      userId: client.user.id,
      displayName: client.user.displayName,
    });
  }

  @SubscribeMessage(WS_ROOM_EVENTS.CHAT_DELETE)
  async onChatDelete(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { messageId: string },
  ) {
    if (!(await this.guardEvent(client))) return;
    if (!this.requireMember(client)) return;
    if (!client.roomCode || !client.user) return;

    const room = await this.prisma.room.findUnique({
      where: { roomCode: client.roomCode },
    });
    if (!room) return;

    const result = await this.chatService.deleteMessage(
      body.messageId,
      room.id,
      client.user.id,
    );
    if (result) {
      this.server
        .to(`room:${client.roomCode}`)
        .emit(WS_ROOM_EVENTS.CHAT_DELETE, result);
    }
  }

  @SubscribeMessage(WS_ROOM_EVENTS.REACTION)
  async onReaction(
    @ConnectedSocket() client: RoomSocket,
    @MessageBody() body: { emoji: string },
  ) {
    if (!(await this.guardEvent(client))) return;
    if (!this.requireMember(client)) return;
    if (!client.roomCode || !client.user) return;

    const emoji = await this.chatService.acceptReaction(
      client.user.id,
      body?.emoji ?? '',
    );
    if (!emoji) return;

    const room = await this.prisma.room.findUnique({
      where: { roomCode: client.roomCode },
    });
    if (room) {
      void this.analytics.incrementSessionReactions(room.id);
    }

    this.server.to(`room:${client.roomCode}`).emit(WS_ROOM_EVENTS.REACTION, {
      userId: client.user.id,
      displayName: client.user.displayName,
      emoji,
      ts: Date.now(),
    });
  }

  private async leaveRoom(client: RoomSocket, roomCode: string) {
    client.leave(`room:${roomCode}`);
    await this.redis.client.hdel(`room:${roomCode}:presence`, client.id);
    client.roomCode = undefined;

    if (!client.isGuest) {
      await this.presence.broadcastParticipants(roomCode);
    }
  }

  private async getParticipants(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: {
        participants: {
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return (
      room?.participants.map((p) => ({
        userId: p.user.id,
        displayName: p.user.displayName,
        role: p.role,
        avatarUrl: p.user.avatarUrl,
      })) ?? []
    );
  }
}
