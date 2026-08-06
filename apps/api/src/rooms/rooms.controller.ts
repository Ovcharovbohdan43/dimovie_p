import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { AuthUser } from '@dimovie/shared';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomScheduleDto } from './dto/create-room.dto';
import { SetVideoDto } from './dto/set-video.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateRoomBrandingDto } from './dto/update-room-branding.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateRoomDto,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return this.roomsService.create(req.user, dto, ip);
  }

  @Public()
  @Get('public')
  listPublic() {
    return this.roomsService.listPublic();
  }

  @Get('mine')
  listMine(@Req() req: { user: AuthUser }) {
    return this.roomsService.listMine(req.user.id);
  }

  @Public()
  @Get(':code/preview')
  getPreview(@Param('code') code: string) {
    return this.roomsService.getPreviewByCode(code);
  }

  /** Guest watch — no account required (password rooms need body). */
  @Public()
  @Get(':code/watch')
  getWatch(@Param('code') code: string) {
    return this.roomsService.getGuestWatch(code);
  }

  @Public()
  @Post(':code/watch')
  unlockWatch(@Param('code') code: string, @Body() dto: JoinRoomDto) {
    return this.roomsService.getGuestWatch(code, dto.password);
  }

  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.roomsService.getByCode(code);
  }

  @Post(':code/join')
  join(
    @Param('code') code: string,
    @Req() req: { user: AuthUser },
    @Body() dto: JoinRoomDto,
  ) {
    return this.roomsService.join(code, req.user, dto);
  }

  @Post(':id/video')
  setVideo(
    @Param('id') id: string,
    @Req() req: { user: AuthUser },
    @Body() dto: SetVideoDto,
  ) {
    return this.roomsService.setVideo(id, req.user.id, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.roomsService.close(id, req.user.id);
  }

  @Patch(':id/branding')
  updateBranding(
    @Param('id') id: string,
    @Req() req: { user: AuthUser },
    @Body() dto: UpdateRoomBrandingDto,
  ) {
    return this.roomsService.updateBranding(id, req.user.id, dto);
  }

  @Patch(':id/schedule')
  updateSchedule(
    @Param('id') id: string,
    @Req() req: { user: AuthUser },
    @Body() dto: UpdateRoomScheduleDto,
  ) {
    return this.roomsService.updateSchedule(id, req.user.id, dto);
  }
}
