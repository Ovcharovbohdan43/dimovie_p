import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@dimovie/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get('me')
  getMe(@Req() req: { user: AuthUser }) {
    return this.profilesService.getProfile(req.user.id);
  }

  @Patch('me')
  updateMe(@Req() req: { user: AuthUser }, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.id, dto);
  }

  @Get('me/history')
  async getHistory(@Req() req: { user: AuthUser }) {
    await this.subscriptions.requireFeature(req.user.id, 'watchHistory');
    return this.profilesService.getWatchHistory(req.user.id);
  }
}
