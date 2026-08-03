import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { WS_ROOM_EVENTS } from '@dimovie/shared';
import { getPlanCapabilities } from '@dimovie/shared';
import type { AuthedSocket } from '../realtime/ws-auth.service';
import { WsAuthService } from '../realtime/ws-auth.service';
import { VoiceService } from './voice.service';
import { PrismaService } from '../prisma/prisma.service';

interface VoicePeer {
  roomCode: string;
  userId: string;
  displayName: string;
}

@WebSocketGateway({
  namespace: '/voice',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly peers = new Map<string, VoicePeer>();

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

  handleDisconnect(client: AuthedSocket) {
    const peer = this.peers.get(client.id);
    if (!peer) return;

    this.peers.delete(client.id);
    client
      .to(`voice:${peer.roomCode}`)
      .emit(WS_ROOM_EVENTS.VOICE_PEERS, { peers: this.listPeers(peer.roomCode) });
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
    const roomPeers = this.listPeers(roomCode);

    if (roomPeers.length >= caps.maxVoicePeers) {
      client.emit(WS_ROOM_EVENTS.ERROR, {
        message: 'Voice channel is full for this plan',
        scope: 'voice',
      });
      return;
    }

    if (client.data.voiceRoomCode) {
      client.leave(`voice:${client.data.voiceRoomCode}`);
    }

    client.data.voiceRoomCode = roomCode;
    client.join(`voice:${roomCode}`);
    this.peers.set(client.id, {
      roomCode,
      userId: client.user.id,
      displayName: client.user.displayName,
    });

    const useSfu = caps.voiceMode === 'sfu' && caps.enhancedVoice;
    const transport = useSfu
      ? await this.voiceService.createWebRtcTransport(roomCode)
      : null;
    const capsRtp = useSfu
      ? this.voiceService.getRouterCapabilities(roomCode)
      : null;

    client.emit(WS_ROOM_EVENTS.VOICE_PEERS, {
      mode: useSfu && transport ? 'sfu' : 'p2p',
      maxPeers: caps.maxVoicePeers,
      enhancedAudio: caps.enhancedVoice,
      routerRtpCapabilities: capsRtp,
      transport: transport
        ? {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        : null,
      peers: this.listPeers(roomCode).filter((p) => p.userId !== client.user.id),
    });

    client
      .to(`voice:${roomCode}`)
      .emit(WS_ROOM_EVENTS.VOICE_PEERS, { peers: this.listPeers(roomCode) });
  }

  @SubscribeMessage(WS_ROOM_EVENTS.VOICE_LEAVE)
  onVoiceLeave(@ConnectedSocket() client: AuthedSocket) {
    const peer = this.peers.get(client.id);
    if (!peer) return;

    this.peers.delete(client.id);
    client.leave(`voice:${peer.roomCode}`);
    client.data.voiceRoomCode = undefined;

    client
      .to(`voice:${peer.roomCode}`)
      .emit(WS_ROOM_EVENTS.VOICE_PEERS, { peers: this.listPeers(peer.roomCode) });
  }

  @SubscribeMessage(WS_ROOM_EVENTS.VOICE_SIGNAL)
  onVoiceSignal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { targetUserId: string; signal: unknown },
  ) {
    if (!client.user) return;

    for (const [socketId, peer] of this.peers.entries()) {
      if (peer.userId === body.targetUserId) {
        this.server.to(socketId).emit(WS_ROOM_EVENTS.VOICE_SIGNAL, {
          fromUserId: client.user.id,
          signal: body.signal,
        });
        return;
      }
    }
  }

  private listPeers(roomCode: string) {
    return [...this.peers.entries()]
      .filter(([, peer]) => peer.roomCode === roomCode)
      .map(([socketId, peer]) => ({
        userId: peer.userId,
        displayName: peer.displayName,
        socketId,
      }));
  }
}
