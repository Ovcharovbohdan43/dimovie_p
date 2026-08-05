import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MediaModule } from './media/media.module';
import { VoiceModule } from './voice/voice.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ModerationModule } from './moderation/moderation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CatalogModule } from './catalog/catalog.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 120 },
      { name: 'auth', ttl: 60000, limit: 20 },
      { name: 'strict', ttl: 60000, limit: 30 },
    ]),
    PrismaModule,
    RedisModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    RealtimeModule,
    MediaModule,
    VoiceModule,
    ProfilesModule,
    SubscriptionsModule,
    ModerationModule,
    AnalyticsModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
