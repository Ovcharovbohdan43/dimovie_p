import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
import { getCorsOptions } from '../common/cors';

/**
 * Socket.IO Redis adapter so room broadcasts work across Railway replicas.
 * Without this, chat/sync only reach clients on the same process that joined.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
      this.logger.error(`Redis pub error: ${err.message}`);
    });
    subClient.on('error', (err) => {
      this.logger.error(`Redis sub error: ${err.message}`);
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        if (pubClient.status === 'ready') {
          resolve();
          return;
        }
        pubClient.once('ready', () => resolve());
        pubClient.once('error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        if (subClient.status === 'ready') {
          resolve();
          return;
        }
        subClient.once('ready', () => resolve());
        subClient.once('error', reject);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Socket.IO Redis adapter ready');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: getCorsOptions(),
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      this.logger.warn(
        'Socket.IO Redis adapter not connected — room events stay in-process only',
      );
    }

    return server;
  }
}
