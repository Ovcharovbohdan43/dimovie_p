import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SecurityModule } from '../security/security.module';
import { RealtimeGateway } from './realtime.gateway';
import { WsAuthService } from './ws-auth.service';
import { SyncService } from './sync.service';
import { ChatService } from './chat.service';
import { RoomPresenceService } from './room-presence.service';

@Module({
  imports: [
    AuthModule,
    SecurityModule,
    forwardRef(() => ModerationModule),
    AnalyticsModule,
  ],
  providers: [
    RealtimeGateway,
    WsAuthService,
    SyncService,
    ChatService,
    RoomPresenceService,
  ],
  exports: [SyncService, ChatService, RoomPresenceService, WsAuthService],
})
export class RealtimeModule {}
