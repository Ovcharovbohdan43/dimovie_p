import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserProfile, WatchHistoryItem } from '@dimovie/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.toProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName.trim() }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
    return this.toProfile(user);
  }

  async getWatchHistory(userId: string): Promise<WatchHistoryItem[]> {
    const items = await this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 50,
    });
    return items.map((i) => ({
      id: i.id,
      title: i.title,
      thumbnail: i.thumbnail,
      videoUrl: i.videoUrl,
      watchedAt: i.watchedAt.toISOString(),
      duration: i.duration,
      roomId: i.roomId,
    }));
  }

  async addWatchHistory(
    userId: string,
    data: { title: string; thumbnail?: string; videoUrl?: string; roomId?: string; duration?: number },
  ) {
    return this.prisma.watchHistory.create({
      data: {
        userId,
        title: data.title,
        thumbnail: data.thumbnail,
        videoUrl: data.videoUrl,
        roomId: data.roomId,
        duration: data.duration ?? 0,
      },
    });
  }

  private toProfile(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    subscription: 'FREE' | 'PRO' | 'ENTERPRISE';
    createdAt: Date;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      subscription: user.subscription,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
