import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WS_ROOM_EVENTS } from '@dimovie/shared';
import { getPlanCapabilities } from '@dimovie/shared';
import type { AuthedSocket } from '../realtime/ws-auth.service';
import { WsAuthService } from '../realtime/ws-auth.service';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma/prisma.service';
import { getCorsOptions } from '../common/cors';

type VoiceSocketData = {
  voiceRoomCode?: string;
  voiceUserId?: string;
  voiceDisplayName?: string;
};

@WebSocketGateway({
  namespace: '/voice',
  cors: getCorsOptions(),
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(VoiceGateway.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly wsAuth: WsAuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    try {
      client.user = await this.wsAuth.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    const data = client.data as VoiceSocketData;
    const roomCode = data.voiceRoomCode;
    if (!roomCode) return;

    client.leave(`voice:${roomCode}`);
    data.voiceRoomCode = undefined;
    await this.emitPeerLists(roomCode);
  }

  @SubscribeMessage(WS_ROOM_EVENTS.VOICE_JOIN)
  async onVoiceJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { roomCode: string },
  ) {
    if (!client.user) return;

    const roomCode = body.roomCode.toUpperCase();
    const room = await this.prisma.room.findUnique({
      where: { roomCode },
      include: { owner: { select: { subscription: true } } },
    });
    if (!room || room.status !== 'ACTIVE') return;

    const caps = getPlanCapabilities(room.owner.subscription);
    const existingPeers = await this.listPeers(roomCode);

    if (existingPeers.length >= caps.maxVoicePeers) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Voice channel is full for this plan',
        scope: 'voice',
      });
      return;
    }

    const data = client.data as VoiceSocketData;
    if (data.voiceRoomCode) {
      client.leave(`voice:${data.voiceRoomCode}`);
    }

    data.voiceRoomCode = roomCode;
    data.voiceUserId = client.user.id;
    data.voiceDisplayName = client.user.displayName;
    client.join(`voice:${roomCode}`);

    const useSfu =
      caps.voiceMode === 'sfu' &&
      caps.enhancedVoice &&
      this.voiceService.isSfuReady();
    const transport = useSfu
      ? await this.voiceService.createWebRtcTransport(roomCode)
      : null;
    const capsRtp = useSfu
      ? this.voiceService.getRouterCapabilities(roomCode)
      : null;

    const iceServers = await this.voiceService.getIceServers(client.user.id);
    const peers = (await this.listPeers(roomCode)).filter(
      (p) => p.userId !== client.user!.id,
    );

    this.logger.log(
      `voice join room=${roomCode} user=${client.user.id} peers=${peers.length} ice=${iceServers.length}`,
    );

    client.emit(WS_ROOM_EVENTS.VOICE_PEERS, {
      mode: useSfu && transport ? 'sfu' : 'p2p',
      maxPeers: caps.maxVoicePeers,
      enhancedAudio: caps.enhancedVoice,
      iceServers,
      routerRtpCapabilities: capsRtp,
      transport: transport
        ? {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        : null,
      peers,
    });

    await this.emitPeerLists(roomCode, client.id);
  }

  @SubscribeMessage(WS_ROOM_EVENTS.VOICE_LEAVE)
  async onVoiceLeave(@ConnectedSocket() client: AuthedSocket) {
    const data = client.data as VoiceSocketData;
    const roomCode = data.voiceRoomCode;
    if (!roomCode) return;

    client.leave(`voice:${roomCode}`);
    data.voiceRoomCode = undefined;
    data.voiceUserId = undefined;
    data.voiceDisplayName = undefined;

    await this.emitPeerLists(roomCode);
  }

  @SubscribeMessage(WS_ROOM_EVENTS.VOICE_SIGNAL)
  async onVoiceSignal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { targetUserId: string; signal: unknown },
  ) {
    if (!client.user) return;
    const data = client.data as VoiceSocketData;
    const roomCode = data.voiceRoomCode;
    if (!roomCode || !body.targetUserId) return;

    // Room broadcast works across Socket.IO Redis adapter replicas.
    // Clients ignore signals not addressed to them.
    client.to(`voice:${roomCode}`).emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
      fromUserId: client.user.id,
      targetUserId: body.targetUserId,
      signal: body.signal,
    });
  }

  private async listPeers(roomCode: string) {
    const sockets = await this.server.in(`voice:${roomCode}`).fetchSockets();
    const peers: { userId: string; displayName: string; socketId: string }[] =
      [];
    const seen = new Set<string>();

    for (const sock of sockets) {
      const data = sock.data as VoiceSocketData;
      const userId = data.voiceUserId;
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      peers.push({
        userId,
        displayName: data.voiceDisplayName || 'Guest',
        socketId: sock.id,
      });
    }

    return peers;
  }

  private async emitPeerLists(roomCode: string, exceptSocketId?: string) {
    const sockets = await this.server.in(`voice:${roomCode}`).fetchSockets();
    const allPeers = await this.listPeers(roomCode);

    for (const sock of sockets) {
      if (exceptSocketId && sock.id === exceptSocketId) continue;
      const data = sock.data as VoiceSocketData;
      const selfId = data.voiceUserId;
      sock.emit(WS_ROOM_EVENTS.VOICE_PEERS, {
        peers: allPeers.filter((p) => p.userId !== selfId),
      });
    }
  }
}
