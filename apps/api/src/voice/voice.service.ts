import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import type { types as MediasoupTypes } from 'mediasoup';

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

@Injectable()
export class VoiceService implements OnModuleInit {
  private readonly logger = new Logger(VoiceService.name);
  private worker: MediasoupTypes.Worker | null = null;
  private routers = new Map<string, MediasoupTypes.Router>();
  private sfuEnabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const wantSfu = this.config.get<string>('VOICE_SFU_ENABLED', 'false') === 'true';
    if (!wantSfu) {
      this.logger.log(
        'SFU disabled (VOICE_SFU_ENABLED!=true) — voice uses P2P + TURN/STUN',
      );
      return;
    }

    const announcedIp = this.config.get<string>('MEDIASOUP_ANNOUNCED_IP')?.trim();
    if (!announcedIp) {
      this.logger.warn(
        'VOICE_SFU_ENABLED=true but MEDIASOUP_ANNOUNCED_IP is missing — falling back to P2P',
      );
      return;
    }

    const rtcMinPort = Number(this.config.get('MEDIASOUP_RTC_MIN_PORT', 40000));
    const rtcMaxPort = Number(this.config.get('MEDIASOUP_RTC_MAX_PORT', 40100));

    try {
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort,
        rtcMaxPort,
      });
      this.worker.on('died', () => {
        this.logger.error('Mediasoup worker died');
        this.sfuEnabled = false;
        this.worker = null;
      });
      this.sfuEnabled = true;
      this.logger.log(
        `Mediasoup SFU worker started (UDP/TCP ${rtcMinPort}-${rtcMaxPort}, announced ${announcedIp})`,
      );
    } catch (err) {
      this.logger.warn(
        'Mediasoup unavailable — voice will use P2P + TURN fallback',
        err instanceof Error ? err.message : err,
      );
      this.sfuEnabled = false;
      this.worker = null;
    }
  }

  isSfuReady() {
    return this.sfuEnabled && !!this.worker;
  }

  /** ICE servers for browser PeerConnections (P2P and SFU clients). */
  getIceServers(): IceServerConfig[] {
    const servers: IceServerConfig[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrlsRaw = this.config.get<string>('TURN_URLS')?.trim();
    if (!turnUrlsRaw) {
      this.logger.warn(
        'TURN_URLS not set — voice may fail behind strict NATs. Configure coturn or a TURN provider.',
      );
      return servers;
    }

    const urls = turnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) return servers;

    const username = this.config.get<string>('TURN_USERNAME')?.trim();
    const credential = this.config.get<string>('TURN_CREDENTIAL')?.trim();

    servers.push({
      urls: urls.length === 1 ? urls[0]! : urls,
      ...(username ? { username } : {}),
      ...(credential ? { credential } : {}),
    });

    return servers;
  }

  async getOrCreateRouter(
    roomCode: string,
  ): Promise<MediasoupTypes.Router | null> {
    if (!this.worker || !this.sfuEnabled) return null;
    const existing = this.routers.get(roomCode);
    if (existing) return existing;

    const router = await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ],
    });
    this.routers.set(roomCode, router);
    return router;
  }

  async createWebRtcTransport(
    roomCode: string,
  ): Promise<MediasoupTypes.WebRtcTransport | null> {
    const router = await this.getOrCreateRouter(roomCode);
    if (!router) return null;

    const listenIp = this.config.get('MEDIASOUP_LISTEN_IP', '0.0.0.0');
    const announcedIp = this.config.get<string>('MEDIASOUP_ANNOUNCED_IP')?.trim();
    const preferTcp =
      this.config.get<string>('MEDIASOUP_PREFER_TCP', 'false') === 'true';

    return router.createWebRtcTransport({
      listenIps: [{ ip: listenIp, announcedIp: announcedIp || undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: !preferTcp,
      initialAvailableOutgoingBitrate: 600000,
    });
  }

  getRouterCapabilities(roomCode: string) {
    const router = this.routers.get(roomCode);
    return router?.rtpCapabilities ?? null;
  }

  closeRoom(roomCode: string) {
    const router = this.routers.get(roomCode);
    if (router) {
      router.close();
      this.routers.delete(roomCode);
    }
  }
}
