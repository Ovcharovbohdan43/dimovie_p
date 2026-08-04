import { createHmac } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import type { types as MediasoupTypes } from 'mediasoup';

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * Open Relay (Metered) static-auth secret — used by Nextcloud Talk / Matrix.
 * Generates short-lived TURN REST credentials so mobile ↔ desktop NAT works
 * without requiring TURN_URLS on Railway.
 */
const OPEN_RELAY_STATIC_SECRET = 'openrelayprojectsecret';
const OPEN_RELAY_TTL_SEC = 24 * 60 * 60;

@Injectable()
export class VoiceService implements OnModuleInit {
  private readonly logger = new Logger(VoiceService.name);
  private worker: MediasoupTypes.Worker | null = null;
  private routers = new Map<string, MediasoupTypes.Router>();
  private sfuEnabled = false;
  private meteredCache:
    | { expiresAt: number; servers: IceServerConfig[] }
    | null = null;

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
  async getIceServers(userId = 'dimovie'): Promise<IceServerConfig[]> {
    const configured = this.getConfiguredTurnServers();
    if (configured) {
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...configured,
      ];
    }

    const metered = await this.fetchMeteredIceServers();
    if (metered?.length) {
      this.logger.log(`Voice ICE: Metered TURN (${metered.length} entries)`);
      return metered;
    }

    const openRelay = this.buildOpenRelayIceServers(userId);
    this.logger.log(
      'Voice ICE: Open Relay static-auth TURN (set TURN_URLS or METERED_TURN_API_URL to override)',
    );
    return openRelay;
  }

  private getConfiguredTurnServers(): IceServerConfig[] | null {
    const turnUrlsRaw = this.config.get<string>('TURN_URLS')?.trim();
    if (!turnUrlsRaw) return null;

    const urls = turnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) return null;

    const username = this.config.get<string>('TURN_USERNAME')?.trim();
    const credential = this.config.get<string>('TURN_CREDENTIAL')?.trim();

    return [
      {
        urls: urls.length === 1 ? urls[0]! : urls,
        ...(username ? { username } : {}),
        ...(credential ? { credential } : {}),
      },
    ];
  }

  private async fetchMeteredIceServers(): Promise<IceServerConfig[] | null> {
    const apiUrl = this.config.get<string>('METERED_TURN_API_URL')?.trim();
    if (!apiUrl) return null;

    const now = Date.now();
    if (this.meteredCache && this.meteredCache.expiresAt > now) {
      return this.meteredCache.servers;
    }

    try {
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.logger.warn(`Metered TURN API HTTP ${res.status}`);
        return null;
      }
      const data = (await res.json()) as IceServerConfig[];
      if (!Array.isArray(data) || data.length === 0) return null;
      this.meteredCache = {
        servers: data,
        expiresAt: now + 50 * 60 * 1000,
      };
      return data;
    } catch (err) {
      this.logger.warn(
        `Metered TURN fetch failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** TURN REST (HMAC-SHA1) credentials for staticauth.openrelay.metered.ca */
  private buildOpenRelayIceServers(userId: string): IceServerConfig[] {
    const expiry = Math.floor(Date.now() / 1000) + OPEN_RELAY_TTL_SEC;
    const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'peer';
    const username = `${expiry}:${safeId}`;
    const credential = createHmac('sha1', OPEN_RELAY_STATIC_SECRET)
      .update(username)
      .digest('base64');

    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:staticauth.openrelay.metered.ca:80',
        username,
        credential,
      },
      {
        urls: 'turn:staticauth.openrelay.metered.ca:443',
        username,
        credential,
      },
      {
        urls: 'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
        username,
        credential,
      },
      {
        urls: 'turns:staticauth.openrelay.metered.ca:443',
        username,
        credential,
      },
    ];
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
