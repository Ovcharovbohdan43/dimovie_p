import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { RoomPresenceService } from '../realtime/room-presence.service';



@Injectable()

export class ModerationService {

  constructor(

    private readonly prisma: PrismaService,

    @Inject(forwardRef(() => RoomPresenceService))

    private readonly presence: RoomPresenceService,

  ) {}



  async kickParticipant(roomId: string, ownerId: string, targetUserId: string) {

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    if (!room) throw new NotFoundException('Room not found');

    if (room.ownerId !== ownerId) {

      throw new ForbiddenException('Only owner can kick participants');

    }

    if (targetUserId === ownerId) {

      throw new ForbiddenException('Cannot kick yourself');

    }



    await this.prisma.participant.deleteMany({

      where: { roomId, userId: targetUserId },

    });



    await this.presence.removeUserFromRoom(room.roomCode, targetUserId, {

      action: 'kicked',

      message: 'The host removed you from the room',

    });



    return { roomId, roomCode: room.roomCode, userId: targetUserId, action: 'kicked' };
  }

  async setParticipantRole(
    roomId: string,
    ownerId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.ownerId !== ownerId) {
      throw new ForbiddenException('Only owner can assign roles');
    }
    if (targetUserId === ownerId) {
      throw new ForbiddenException('Cannot change host role');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }
    if (participant.role === 'OWNER') {
      throw new BadRequestException('Cannot change host role');
    }

    await this.prisma.participant.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role },
    });

    await this.presence.broadcastParticipants(room.roomCode);

    return { roomId, roomCode: room.roomCode, userId: targetUserId, role };
  }

  async banUser(

    roomId: string,

    ownerId: string,

    targetUserId: string,

    reason?: string,

  ) {

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    if (!room) throw new NotFoundException('Room not found');

    if (room.ownerId !== ownerId) {

      throw new ForbiddenException('Only owner can ban users');

    }

    if (targetUserId === ownerId) {

      throw new ForbiddenException('Cannot ban yourself');

    }



    await this.prisma.hostBan.upsert({

      where: { hostId_userId: { hostId: ownerId, userId: targetUserId } },

      create: { hostId: ownerId, userId: targetUserId, reason },

      update: { reason },

    });



    const hostRooms = await this.prisma.room.findMany({

      where: { ownerId, status: 'ACTIVE' },

      select: { id: true, roomCode: true },

    });

    const hostRoomIds = hostRooms.map((r) => r.id);



    await this.prisma.participant.deleteMany({

      where: { roomId: { in: hostRoomIds }, userId: targetUserId },

    });



    for (const hostRoom of hostRooms) {

      await this.prisma.roomBan.upsert({

        where: {

          roomId_userId: { roomId: hostRoom.id, userId: targetUserId },

        },

        create: {

          roomId: hostRoom.id,

          userId: targetUserId,

          bannedBy: ownerId,

          reason,

        },

        update: { reason, bannedBy: ownerId },

      });

    }



    await this.presence.removeUserFromRooms(

      hostRooms.map((r) => r.roomCode),

      targetUserId,

      {

        action: 'banned',

        message: 'The host blocked you — you cannot join their rooms',

      },

    );



    return {

      roomId,

      hostId: ownerId,

      userId: targetUserId,

      action: 'banned',

    };

  }



  async isBanned(roomId: string, userId: string): Promise<boolean> {

    const ban = await this.prisma.roomBan.findUnique({

      where: { roomId_userId: { roomId, userId } },

    });

    return !!ban;

  }



  async isBannedByHost(hostId: string, userId: string): Promise<boolean> {

    const ban = await this.prisma.hostBan.findUnique({

      where: { hostId_userId: { hostId, userId } },

    });

    return !!ban;

  }



  async canJoinRoom(roomId: string, hostId: string, userId: string) {

    if (await this.isBannedByHost(hostId, userId)) {

      return { allowed: false, reason: 'You are blocked by the host' };

    }

    if (await this.isBanned(roomId, userId)) {

      return { allowed: false, reason: 'You are banned from this room' };

    }

    return { allowed: true as const };

  }



  async getBans(roomId: string, ownerId: string) {

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });

    if (!room) throw new NotFoundException('Room not found');

    if (room.ownerId !== ownerId) {

      throw new ForbiddenException('Only owner can view bans');

    }



    return this.prisma.roomBan.findMany({

      where: { roomId },

      include: {

        user: { select: { id: true, displayName: true, avatarUrl: true } },

      },

    });

  }

}


