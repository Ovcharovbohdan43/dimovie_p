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
import { WS_ROOM_EVENTS } from '@dimovie/shared';
import type { SyncIntentPayload } from '@dimovie/shared';
import { WsAuthService, type AuthedSocket } from './ws-auth.service';
import { SyncService } from './sync.service';
import { ChatService } from './chat.service';
import { RoomPresenceService } from './room-presence.service';
import { ModerationService } from '../moderation/moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { getCorsOptions } from '../common/cors';

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

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly syncService: SyncService,
    private readonly chatService: ChatService,
    private readonly presence: RoomPresenceService,
    private readonly moderation: ModerationService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly analytics: AnalyticsService,
  ) {}

  afterInit(server: Server) {
    this.presence.setServer(server);
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.user = user;
      client.data.userId = user.id;
      this.logger.log(`ws connected user=${user.id}`);
    } catch (err) {
      this.logger.warn(
        `ws auth failed: ${err instanceof Error ? err.message : 'unauthorized'}`,
      );
      client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (client.roomCode) {
      await this.leaveRoom(client, client.roomCode);
    }
  }

  @SubscribeMessage(WS_ROOM_EVENTS.JOIN)
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomCode: string; password?: string },
  ) {
    const roomCode = body.roomCode.toUpperCase();
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: { participants: true, owner: true },
    });

    if (!room || room.status !== 'ACTIVE') {
      client.emit(WS_ROOM_EVENTS.ERROR, { message: 'Room not found' });
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
      (p) => p.userId === client.user.id,
    );

    if (!isParticipant) {
      if (room.privacy === 'PUBLIC' || room.privacy === 'PRIVATE') {
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
    });

    client.to(`room:${roomCode}`).emit(WS_ROOM_EVENTS.PARTICIPANTS, participants);

    void this.analytics.updateSessionPeak(room.id, participants.length);
  }

  @SubscribeMessage(WS_ROOM_EVENTS.LEAVE)
  async onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomCode: string },
  ) {
    await this.leaveRoom(client, body.roomCode.toUpperCase());
  }

  @SubscribeMessage(WS_ROOM_EVENTS.SYNC_INTENT)
  async onSyncIntent(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() intent: SyncIntentPayload,
  ) {
    if (!client.roomCode) return;

    try {
      const state = await this.syncService.applyIntent(
        client.roomCode,
        client.user.id,
        intent,
      );

      this.server.in(`room:${client.roomCode}`).emit(WS_ROOM_EVENTS.SYNC_STATE, state);
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
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { content: string },
  ) {
    if (!client.roomCode) {
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
          // Echo to sender first, then room (covers Redis/adapter edge cases)
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

  @SubscribeMessage(WS_ROOM_EVENTS.CHAT_DELETE)
  async onChatDelete(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { messageId: string },
  ) {
    if (!client.roomCode) return;

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
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { emoji: string },
  ) {
    if (!client.roomCode) return;

    const room = await this.prisma.room.findUnique({
      where: { roomCode: client.roomCode },
    });
    if (room) {
      void this.analytics.incrementSessionReactions(room.id);
    }

    this.server.to(`room:${client.roomCode}`).emit(WS_ROOM_EVENTS.REACTION, {
      userId: client.user.id,
      displayName: client.user.displayName,
      emoji: body.emoji,
      ts: Date.now(),
    });
  }

  private async leaveRoom(client: AuthedSocket, roomCode: string) {
    client.leave(`room:${roomCode}`);
    await this.redis.client.hdel(`room:${roomCode}:presence`, client.id);
    client.roomCode = undefined;

    await this.presence.broadcastParticipants(roomCode);
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
