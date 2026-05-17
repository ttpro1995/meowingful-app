import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { CacheService } from '../redis/cache.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockCacheService: { ping: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('should return health status with timestamp, uptime and redis status', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');

      const result = await controller.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(result.redis).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });

    it('should return ISO string timestamp', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');

      const result = await controller.getHealth();
      const date = new Date(result.timestamp);

      expect(date.toISOString()).toBe(result.timestamp);
    });

    it('should return positive uptime', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');

      const result = await controller.getHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return redis status as down when ping fails', async () => {
      mockCacheService.ping.mockResolvedValue('down');

      const result = await controller.getHealth();

      expect(result.redis).toBe('down');
    });

    it('should return redis status as down when ping throws', async () => {
      mockCacheService.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.getHealth();

      expect(result.redis).toBe('down');
    });
  });
});
