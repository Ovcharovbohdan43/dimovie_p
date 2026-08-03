import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@dimovie/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('rooms/:roomId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getAnalytics(@Param('roomId') roomId: string, @Req() req: { user: AuthUser }) {
    return this.analyticsService.getRoomAnalytics(roomId, req.user.id);
  }
}
