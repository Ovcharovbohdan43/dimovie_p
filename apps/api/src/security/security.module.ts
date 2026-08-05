import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { TrustScoreService } from './trust-score.service';
import { CaptchaService } from './captcha.service';
import { SecurityWorker } from './security.worker';
import { SecurityController } from './security.controller';
import { OriginMiddleware } from './origin.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [SecurityController],
  providers: [
    RateLimitService,
    TrustScoreService,
    CaptchaService,
    SecurityWorker,
  ],
  exports: [RateLimitService, TrustScoreService, CaptchaService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginMiddleware).forRoutes('*');
  }
}
