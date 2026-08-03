import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@dimovie/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModerationService } from './moderation.service';
import { KickDto } from './dto/kick.dto';
import { BanDto } from './dto/ban.dto';
import { SetRoleDto } from './dto/set-role.dto';

@Controller('rooms/:roomId/moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('kick')
  kick(
    @Param('roomId') roomId: string,
    @Req() req: { user: AuthUser },
    @Body() dto: KickDto,
  ) {
    return this.moderationService.kickParticipant(roomId, req.user.id, dto.userId);
  }

  @Post('ban')
  ban(
    @Param('roomId') roomId: string,
    @Req() req: { user: AuthUser },
    @Body() dto: BanDto,
  ) {
    return this.moderationService.banUser(roomId, req.user.id, dto.userId, dto.reason);
  }

  @Post('role')
  setRole(
    @Param('roomId') roomId: string,
    @Req() req: { user: AuthUser },
    @Body() dto: SetRoleDto,
  ) {
    return this.moderationService.setParticipantRole(
      roomId,
      req.user.id,
      dto.userId,
      dto.role,
    );
  }

  @Get('bans')
  getBans(@Param('roomId') roomId: string, @Req() req: { user: AuthUser }) {
    return this.moderationService.getBans(roomId, req.user.id);
  }
}
