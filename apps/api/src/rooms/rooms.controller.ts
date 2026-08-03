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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { SetVideoDto } from './dto/set-video.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateRoomBrandingDto } from './dto/update-room-branding.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(req.user, dto);
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
}
