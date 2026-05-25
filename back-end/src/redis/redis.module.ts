import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

const redisLogger = new Logger('RedisModule');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD', '');

        const redisOptions: { host: string; port: number; password?: string } =
          {
            host,
            port,
          };

        if (password) {
          redisOptions.password = password;
        }

        const client = new Redis({
          ...redisOptions,
          lazyConnect: process.env.NODE_ENV === 'test',
          retryStrategy: (times) => {
            if (times > 10) {
              return null;
            }
            return Math.min(times * 100, 2000);
          },
        });

        if (process.env.NODE_ENV !== 'test') {
          client.on('connect', () => {
            redisLogger.log('Redis connected');
          });

          client.on('error', (err) => {
            redisLogger.warn(`Redis connection error: ${err.message}`);
          });
        }

        return client;
      },
      inject: [ConfigService],
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
