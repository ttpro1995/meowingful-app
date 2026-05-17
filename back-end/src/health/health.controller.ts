import { Controller, Get } from '@nestjs/common';
import { CacheService } from '../redis/cache.service';

@Controller('health')
export class HealthController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  async getHealth() {
    const uptime = process.uptime();
    let redisStatus: 'ok' | 'down' = 'down';

    try {
      const ping = await this.cacheService.ping();
      redisStatus = ping === 'PONG' ? 'ok' : 'down';
    } catch {
      redisStatus = 'down';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      redis: redisStatus,
    };
  }
}
