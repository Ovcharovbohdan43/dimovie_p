import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy(times) {
            const delay = Math.min(times * 200, 5000);
            logger.warn(`Redis reconnect attempt ${times}, next in ${delay}ms`);
            return delay;
          },
        });
        client.on('error', (err) => {
          logger.error(`Redis error: ${err.message}`);
        });
        client.on('connect', () => logger.log('Redis connected'));
        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
