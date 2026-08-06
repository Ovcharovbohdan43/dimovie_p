import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type {
  RoomPrivacy,
  RoomSummary,
  AuthUser,
  RoomBranding,
  PlanCapabilities,
  GuestWatchRoom,
} from '@dimovie/shared';
import {
  getVideoPreview,
  getPlanCapabilities,
  ROOM_CODE_LENGTH,
  rankDiscoverRooms,
} from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ModerationService } from '../moderation/moderation.service';
import { ProfilesService } from '../profiles/profiles.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomScheduleDto } from './dto/create-room.dto';
import { SetVideoDto } from './dto/set-video.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateRoomBrandingDto } from './dto/update-room-branding.dto';
import { RoomPresenceService } from '../realtime/room-presence.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RateLimitService } from '../security/rate-limit.service';
import { TrustScoreService } from '../security/trust-score.service';
import { CaptchaService } from '../security/captcha.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly subscriptions: SubscriptionsService,
    private readonly moderation: ModerationService,
    private readonly profiles: ProfilesService,
    @Inject(forwardRef(() => RoomPresenceService))
    private readonly presence: RoomPresenceService,
    private readonly analytics: AnalyticsService,
    private readonly rateLimit: RateLimitService,
    private readonly trust: TrustScoreService,
    private readonly captcha: CaptchaService,
  ) {}

  async create(
    user: AuthUser,
    dto: CreateRoomDto,
    ip = 'unknown',
  ): Promise<RoomSummary> {
    const subject = `user:${user.id}`;
    await this.rateLimit.consumeRoomCreate(user.id);
    await this.captcha.assertCaptchaIfNeeded({
      subject,
      captchaToken: dto.captchaToken,
      ip,
      actionLabel: 'room_create',
    });

    if (await this.trust.isSoftBlocked(subject)) {
      throw new ForbiddenException(
        'Unusual activity detected. Wait a bit before creating rooms.',
      );
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    const tier = dbUser?.subscription ?? 'FREE';
    const caps = getPlanCapabilities(tier);

    const activeRooms = await this.prisma.room.count({
      where: { ownerId: user.id, status: 'ACTIVE' },
    });
    if (activeRooms >= caps.maxRooms) {
      throw new ConflictException(
        `Active room limit reached (${caps.maxRooms}). Upgrade your plan for more rooms.`,
      );
    }

    const maxUsersAllowed = caps.maxUsers;

    const roomCode = await this.generateUniqueRoomCode();
    const passwordHash =
      dto.privacy === 'PASSWORD' && dto.password
        ? await argon2.hash(dto.password)
        : null;

    const now = new Date();
    const scheduledStartsAt = this.parseScheduleInput(dto.scheduledStartsAt);
    const room = await this.prisma.room.create({
      data: {
        roomCode,
        ownerId: user.id,
        privacy: dto.privacy,
        passwordHash,
        maxUsers: Math.min(dto.maxUsers ?? maxUsersAllowed, maxUsersAllowed),
        description: dto.description?.trim() || null,
        rules: dto.privacy === 'PUBLIC' ? dto.rules?.trim() || null : null,
        scheduledStartsAt,
        lastActivityAt: now,
        participants: {
          create: { userId: user.id, role: 'OWNER' },
        },
        playbackState: { create: {} },
      },
      include: this.roomInclude(),
    });

    await this.trust.record(subject, 'room_create');
    await this.trust.record(`ip:${ip}`, 'room_create');
    await this.cacheRoomState(room.id, room.roomCode);
    await this.analytics.trackSessionStart(room.id);
    return this.toSummary(room, tier);
  }

  async touchActivity(roomId: string) {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { lastActivityAt: new Date() },
    });
  }

  /**
   * Guest watch — playable stream without creating a Participant.
   * Password rooms require the password; interaction still needs an account.
   */
  async getGuestWatch(
    code: string,
    password?: string,
  ): Promise<GuestWatchRoom> {
    const room = await this.prisma.room.findUnique({
      where: { roomCode: code.toUpperCase() },
      include: this.roomInclude(),
    });
    if (!room || room.status !== 'ACTIVE') {
      throw new NotFoundException('Room not found');
    }

    if (room.privacy === 'PASSWORD') {
      if (!password || !room.passwordHash) {
        throw new ForbiddenException('Password required');
      }
      const valid = await argon2.verify(room.passwordHash, password);
      if (!valid) throw new ForbiddenException('Invalid password');
    }

    const summary = this.toSummary(room, room.owner.subscription ?? 'FREE');
    const syncState = await this.redis.getJson<{
      isPlaying: boolean;
      time: number;
      version: number;
      playbackRate: number;
      serverTs: number;
      by?: string | null;
    }>(`room:${room.roomCode}:state`);

    await this.touchActivity(room.id);

    return {
      room: summary,
      syncState,
      mode: 'guest',
    };
  }

  async listPublic(): Promise<RoomSummary[]> {
    const rooms = await this.prisma.room.findMany({
      where: { privacy: 'PUBLIC', status: 'ACTIVE' },
      include: this.roomInclude(),
      orderBy: { lastActivityAt: 'desc' },
      take: 80,
    });

    const liveCounts = await Promise.all(
      rooms.map(async (room) => {
        try {
          const n = await this.redis.client.hlen(
            `room:${room.roomCode}:presence`,
          );
          return n;
        } catch {
          return 0;
        }
      }),
    );

    const candidates = rooms.map((room, i) => ({
      id: room.id,
      roomCode: room.roomCode,
      ownerId: room.ownerId,
      participantCount: room.participants.length,
      liveViewers: liveCounts[i] ?? 0,
      hasVideo: !!room.videoSource?.url,
      createdAtMs: room.createdAt.getTime(),
      lastActivityAtMs: room.lastActivityAt.getTime(),
      scheduledStartsAtMs: room.scheduledStartsAt?.getTime() ?? null,
      room,
    }));

    const ranked = rankDiscoverRooms(candidates, 48);
    return ranked.map((item) =>
      this.toSummary(
        item.room,
        item.room.owner.subscription ?? 'FREE',
        {
          liveViewers: item.liveViewers,
          discoverScore: Math.round(item.discoverScore * 100) / 100,
        },
      ),
    );
  }

  async listMine(userId: string): Promise<RoomSummary[]> {
    const rooms = await this.prisma.room.findMany({
      where: { ownerId: userId, status: 'ACTIVE' },
      include: this.roomInclude(),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const tier = dbUser?.subscription ?? 'FREE';
    return rooms.map((r) => this.toSummary(r, tier));
  }

  async getByCode(code: string): Promise<RoomSummary> {
    const room = await this.prisma.room.findUnique({
      where: { roomCode: code.toUpperCase() },
      include: this.roomInclude(),
    });
    if (!room || room.status !== 'ACTIVE') {
      throw new NotFoundException('Room not found');
    }
    return this.toSummary(room, room.owner.subscription ?? 'FREE');
  }

  async getPreviewByCode(code: string) {
    const room = await this.getByCode(code);
    const meta = room.videoSource?.metadata;
    const fallbackThumb = room.videoSource?.url
      ? getVideoPreview(room.videoSource.url).thumbnailUrl
      : undefined;

    return {
      roomCode: room.roomCode,
      privacy: room.privacy,
      participantCount: room.participantCount,
      maxUsers: room.maxUsers,
      description: room.description,
      rules: room.rules,
      owner: { displayName: room.owner.displayName },
      requiresPassword: room.privacy === 'PASSWORD',
      scheduledStartsAt: room.scheduledStartsAt ?? null,
      videoPreview: room.videoSource
        ? {
            title: (meta?.title as string | undefined) ?? 'Watch Party',
            thumbnail:
              (meta?.thumbnail as string | undefined) ?? fallbackThumb,
            provider: meta?.provider as string | undefined,
          }
        : undefined,
    };
  }

  async join(code: string, user: AuthUser, dto: JoinRoomDto) {
    const room = await this.prisma.room.findUnique({
      where: { roomCode: code.toUpperCase() },
      include: { participants: true },
    });

    if (!room || room.status !== 'ACTIVE') {
      throw new NotFoundException('Room not found');
    }

    const alreadyJoined = room.participants.some((p) => p.userId === user.id);

    if (room.privacy === 'PASSWORD' && !alreadyJoined) {
      if (!dto.password || !room.passwordHash) {
        throw new ForbiddenException('Password required');
      }
      const valid = await argon2.verify(room.passwordHash, dto.password);
      if (!valid) throw new ForbiddenException('Invalid password');
    }

    const banned = await this.moderation.isBannedByHost(room.ownerId, user.id);
    if (banned) {
      throw new ForbiddenException('You are blocked by the host');
    }

    const roomBanned = await this.moderation.isBanned(room.id, user.id);
    if (roomBanned) {
      throw new ForbiddenException('You are banned from this room');
    }

    const count = room.participants.length;
    if (!alreadyJoined && count >= room.maxUsers) {
      throw new ConflictException('Room is full');
    }

    if (!alreadyJoined) {
      await this.prisma.participant.create({
        data: { roomId: room.id, userId: user.id },
      });
    }

    const full = await this.prisma.room.findUnique({
      where: { id: room.id },
      include: this.roomInclude(),
    });

    const summary = this.toSummary(
      full!,
      full!.owner.subscription ?? 'FREE',
    );

    await this.recordWatchHistory(user.id, summary);
    await this.touchActivity(room.id);

    return summary;
  }

  async updateBranding(roomId: string, userId: string, dto: UpdateRoomBrandingDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: { select: { subscription: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only owner can update branding');
    }

    const caps = getPlanCapabilities(room.owner.subscription);
    if (!caps.customBranding) {
      throw new ForbiddenException('Custom branding requires Enterprise plan');
    }

    const existing = this.parseBranding(room.branding) ?? {};
    const branding: RoomBranding = {
      ...existing,
      ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.displayTitle !== undefined && { displayTitle: dto.displayTitle }),
    };

    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: { branding: branding as object },
      include: this.roomInclude(),
    });

    return this.toSummary(updated, room.owner.subscription);
  }

  async updateSchedule(
    roomId: string,
    userId: string,
    dto: UpdateRoomScheduleDto,
  ) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: { select: { subscription: true } } },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only owner can set the start time');
    }

    const scheduledStartsAt = this.parseScheduleInput(dto.scheduledStartsAt);
    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: { scheduledStartsAt },
      include: this.roomInclude(),
    });

    return this.toSummary(updated, room.owner.subscription);
  }

  private parseScheduleInput(
    value: string | null | undefined,
  ): Date | null {
    if (value === undefined) return null;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid scheduled start time');
    }
    const now = Date.now();
    const maxAhead = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (date.getTime() < now - 60_000) {
      throw new BadRequestException('Start time must be in the future');
    }
    if (date.getTime() - now > maxAhead) {
      throw new BadRequestException(
        'Start time cannot be more than 30 days ahead',
      );
    }
    return date;
  }

  private async recordWatchHistory(userId: string, room: RoomSummary) {
    const caps = await this.subscriptions.getUserCapabilities(userId);
    if (!caps.watchHistory || !room.videoSource) return;

    const meta = room.videoSource.metadata ?? {};
    await this.profiles.addWatchHistory(userId, {
      title: (meta.title as string | undefined) ?? 'Watch Party',
      thumbnail: meta.thumbnail as string | undefined,
      videoUrl: room.videoSource.url,
      roomId: room.id,
    });
  }

  async setVideo(roomId: string, userId: string, dto: SetVideoDto) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only owner can set video');
    }

    const preview = getVideoPreview(this.normalizeVideoUrl(dto.url));
    const provider =
      (dto.metadata?.provider as string | undefined) ?? preview.provider;

    const metadata = {
      ...(dto.metadata ?? {}),
      provider,
      videoId: preview.videoId,
      thumbnail:
        (dto.metadata?.thumbnail as string | undefined) ?? preview.thumbnailUrl,
      title:
        (dto.metadata?.title as string | undefined) ??
        preview.title ??
        'Watch Party',
    };

    await this.prisma.videoSource.upsert({
      where: { roomId },
      create: {
        roomId,
        type: dto.type,
        url: this.normalizeVideoUrl(dto.url),
        metadata: metadata as object,
      },
      update: {
        type: dto.type,
        url: this.normalizeVideoUrl(dto.url),
        metadata: metadata as object,
      },
    });

    return this.getByCode(room.roomCode);
  }

  async close(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only owner can close room');
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'CLOSED' },
    });

    await this.redis.client.del(`room:${room.roomCode}:state`);
    await this.redis.client.del(`room:${room.roomCode}:presence`);

    await this.presence.closeRoom(
      room.roomCode,
      'The host ended the stream',
    );

    await this.analytics.endActiveSession(roomId);

    return { success: true, roomCode: room.roomCode };
  }

  private normalizeVideoUrl(url: string): string {
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  private async generateUniqueRoomCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = ROOM_CODE_LENGTH;
    for (let attempt = 0; attempt < 30; attempt++) {
      const bytes = randomBytes(length);
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars[bytes[i]! % chars.length];
      }
      const exists = await this.prisma.room.findUnique({
        where: { roomCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Could not generate room code');
  }

  private async cacheRoomState(roomId: string, roomCode: string) {
    const state = await this.prisma.playbackState.findUnique({
      where: { roomId },
    });
    if (state) {
      await this.redis.setJson(`room:${roomCode}:state`, {
        isPlaying: state.isPlaying,
        time: state.currentTime,
        version: state.version,
        playbackRate: state.playbackRate,
        serverTs: Date.now(),
        by: state.lastEventBy,
      });
    }
  }

  private roomInclude() {
    return {
      owner: {
        select: { id: true, displayName: true, subscription: true },
      },
      videoSource: true,
      participants: { select: { id: true } },
    } as const;
  }

  private parseBranding(raw: unknown): RoomBranding | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const b = raw as Record<string, unknown>;
    const branding: RoomBranding = {};
    if (typeof b.accentColor === 'string') branding.accentColor = b.accentColor;
    if (typeof b.logoUrl === 'string') branding.logoUrl = b.logoUrl;
    if (typeof b.displayTitle === 'string') branding.displayTitle = b.displayTitle;
    return Object.keys(branding).length > 0 ? branding : undefined;
  }

  private toSummary(
    room: {
      id: string;
      roomCode: string;
      privacy: RoomPrivacy;
      status: string;
      maxUsers: number;
      description?: string | null;
      rules?: string | null;
      branding?: unknown;
      createdAt: Date;
      lastActivityAt?: Date;
      scheduledStartsAt?: Date | null;
      owner: {
        id: string;
        displayName: string;
        subscription?: 'FREE' | 'PRO' | 'ENTERPRISE';
      };
      videoSource?: {
        type: 'EMBED' | 'UPLOAD';
        url: string;
        metadata: unknown;
      } | null;
      participants: { id: string }[];
    },
    ownerTier: 'FREE' | 'PRO' | 'ENTERPRISE' = room.owner.subscription ?? 'FREE',
    extras?: { liveViewers?: number; discoverScore?: number },
  ): RoomSummary {
    const planFeatures = getPlanCapabilities(ownerTier);
    const branding = planFeatures.customBranding
      ? this.parseBranding(room.branding)
      : undefined;

    return {
      id: room.id,
      roomCode: room.roomCode,
      privacy: room.privacy,
      status: room.status,
      maxUsers: room.maxUsers,
      participantCount: room.participants.length,
      liveViewers: extras?.liveViewers,
      discoverScore: extras?.discoverScore,
      description: room.description ?? undefined,
      rules: room.rules ?? undefined,
      owner: { id: room.owner.id, displayName: room.owner.displayName },
      videoSource: room.videoSource
        ? {
            type: room.videoSource.type,
            url: room.videoSource.url,
            metadata:
              (room.videoSource.metadata as Record<string, unknown>) ??
              undefined,
          }
        : undefined,
      planFeatures,
      branding,
      createdAt: room.createdAt.toISOString(),
      lastActivityAt: room.lastActivityAt?.toISOString(),
      scheduledStartsAt: room.scheduledStartsAt?.toISOString() ?? null,
    };
  }
}
