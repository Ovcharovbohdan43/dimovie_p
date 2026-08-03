import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getPlanCapabilities } from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getRoomAnalytics(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: { select: { subscription: true } },
        sessions: { orderBy: { startedAt: 'desc' }, take: 20 },
        participants: true,
        messages: { where: { deletedAt: null } },
      },
    });

    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('Only owner can view analytics');
    }

    const caps = getPlanCapabilities(room.owner.subscription);
    if (!caps.roomAnalytics) {
      throw new ForbiddenException('Room analytics requires Pro plan or higher');
    }

    const totalSessions = room.sessions.length;
    const peakParticipants = Math.max(
      ...room.sessions.map((s) => s.peakParticipants),
      room.participants.length,
    );
    const avgMessagesPerSession =
      totalSessions > 0
        ? Math.round(
            room.sessions.reduce((sum, s) => sum + s.totalMessages, 0) /
              totalSessions,
          )
        : 0;

    const base = {
      roomId: room.id,
      roomCode: room.roomCode,
      totalSessions,
      currentParticipants: room.participants.length,
      peakParticipants,
      totalMessages: room.messages.length,
      sessions: room.sessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        peakParticipants: s.peakParticipants,
        totalMessages: s.totalMessages,
        totalReactions: s.totalReactions,
      })),
    };

    if (!caps.advancedAnalytics) {
      return base;
    }

    return {
      ...base,
      advanced: {
        avgMessagesPerSession,
        engagementScore: Math.min(
          100,
          Math.round(
            (peakParticipants * 2 +
              avgMessagesPerSession +
              room.sessions.reduce((sum, s) => sum + s.totalReactions, 0)) /
              Math.max(totalSessions, 1),
          ),
        ),
        totalReactions: room.sessions.reduce(
          (sum, s) => sum + s.totalReactions,
          0,
        ),
        priorityInfrastructure: caps.prioritySync,
      },
    };
  }

  async trackSessionStart(roomId: string) {
    return this.prisma.roomSession.create({ data: { roomId } });
  }

  async endActiveSession(roomId: string) {
    const session = await this.prisma.roomSession.findFirst({
      where: { roomId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (session) {
      await this.prisma.roomSession.update({
        where: { id: session.id },
        data: { endedAt: new Date() },
      });
    }
  }

  async updateSessionPeak(roomId: string, peak: number) {
    const session = await this.prisma.roomSession.findFirst({
      where: { roomId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (session && peak > session.peakParticipants) {
      await this.prisma.roomSession.update({
        where: { id: session.id },
        data: { peakParticipants: peak },
      });
    }
  }

  async incrementSessionMessages(roomId: string) {
    const session = await this.prisma.roomSession.findFirst({
      where: { roomId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (session) {
      await this.prisma.roomSession.update({
        where: { id: session.id },
        data: { totalMessages: { increment: 1 } },
      });
    }
  }

  async incrementSessionReactions(roomId: string) {
    const session = await this.prisma.roomSession.findFirst({
      where: { roomId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (session) {
      await this.prisma.roomSession.update({
        where: { id: session.id },
        data: { totalReactions: { increment: 1 } },
      });
    }
  }
}
