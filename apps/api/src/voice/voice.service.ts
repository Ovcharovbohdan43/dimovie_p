import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import type { types as MediasoupTypes } from 'mediasoup';

@Injectable()
export class VoiceService implements OnModuleInit {
  private readonly logger = new Logger(VoiceService.name);
  private worker!: MediasoupTypes.Worker;
  private routers = new Map<string, MediasoupTypes.Router>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    try {
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
      });
      this.worker.on('died', () => {
        this.logger.error('Mediasoup worker died');
        process.exit(1);
      });
      this.logger.log('Mediasoup SFU worker started');
    } catch (err) {
      this.logger.warn(
        'Mediasoup unavailable — voice will use P2P fallback',
        err instanceof Error ? err.message : err,
      );
    }
  }

  async getOrCreateRouter(roomCode: string): Promise<MediasoupTypes.Router | null> {
    if (!this.worker) return null;
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

  async createWebRtcTransport(roomCode: string): Promise<MediasoupTypes.WebRtcTransport | null> {
    const router = await this.getOrCreateRouter(roomCode);
    if (!router) return null;

    const listenIp = this.config.get('MEDIASOUP_LISTEN_IP', '0.0.0.0');
    const announcedIp = this.config.get('MEDIASOUP_ANNOUNCED_IP');

    return router.createWebRtcTransport({
      listenIps: [{ ip: listenIp, announcedIp: announcedIp || undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
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
