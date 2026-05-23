import { Controller, Get, Logger } from '@nestjs/common';
import { CacheService } from '../redis/cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  async getHealth() {
    const uptime = process.uptime();
    let redisStatus: 'ok' | 'down' = 'down';
    let dbStatus: 'ok' | 'down' = 'down';

    try {
      const ping = await this.cacheService.ping();
      redisStatus = ping === 'PONG' ? 'ok' : 'down';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      redisStatus = 'down';
    }

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      dbStatus = 'down';
    }

    return {
      status: 'ok',
      db: dbStatus,
      redis: redisStatus,
      uptime,
    };
  }
}
