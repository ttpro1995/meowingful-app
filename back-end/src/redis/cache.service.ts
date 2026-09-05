import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly pendingOperations = new Set<Promise<unknown>>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    while (this.pendingOperations.size > 0) {
      await Promise.allSettled([...this.pendingOperations]);
    }

    if (this.redis.status === 'end') {
      return;
    }

    if (this.redis.status === 'wait') {
      this.redis.disconnect(false);
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect(false);
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.trackOperation(this.redis.set(key, value, 'EX', ttlSeconds));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to set cache key ${key}: ${message}`);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.trackOperation(this.redis.get(key));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get cache key ${key}: ${message}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.trackOperation(this.redis.del(key));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete cache key ${key}: ${message}`);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.trackOperation(this.redis.exists(key));
      return result === 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check existence of key ${key}: ${message}`);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.trackOperation(this.redis.ping());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis ping failed: ${message}`);
      return 'down';
    }
  }

  private trackOperation<T>(operation: Promise<T>): Promise<T> {
    const trackedOperation = operation.finally(() => {
      this.pendingOperations.delete(trackedOperation);
    });
    this.pendingOperations.add(trackedOperation);
    return trackedOperation;
  }
}
