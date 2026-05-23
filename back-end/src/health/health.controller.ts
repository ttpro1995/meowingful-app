import { Controller, Get } from '@nestjs/common';
import { CacheService } from '../redis/cache.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
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
    } catch {
      redisStatus = 'down';
    }

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch {
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
