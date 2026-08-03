import { Module, forwardRef } from '@nestjs/common';

import { RoomsService } from './rooms.service';

import { RoomsController } from './rooms.controller';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { ModerationModule } from '../moderation/moderation.module';

import { ProfilesModule } from '../profiles/profiles.module';

import { RealtimeModule } from '../realtime/realtime.module';

import { AnalyticsModule } from '../analytics/analytics.module';



@Module({

  imports: [

    SubscriptionsModule,

    ModerationModule,

    ProfilesModule,

    AnalyticsModule,

    forwardRef(() => RealtimeModule),

  ],

  controllers: [RoomsController],

  providers: [RoomsService],

  exports: [RoomsService],

})

export class RoomsModule {}


