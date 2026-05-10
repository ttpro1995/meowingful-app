import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    const uptime = process.uptime();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
    };
  }
}
