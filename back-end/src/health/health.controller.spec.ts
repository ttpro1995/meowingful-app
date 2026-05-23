import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { CacheService } from '../redis/cache.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockCacheService: { ping: jest.Mock };
  let mockPrismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      ping: jest.fn(),
    };
    mockPrismaService = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('should return health status with db, uptime and redis status', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');
      mockPrismaService.$queryRaw.mockResolvedValue([1]);

      const result = await controller.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.uptime).toBeDefined();
      expect(result.redis).toBe('ok');
      expect(result.db).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });

    it('should return positive uptime', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');
      mockPrismaService.$queryRaw.mockResolvedValue([1]);

      const result = await controller.getHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return redis status as down when ping fails', async () => {
      mockCacheService.ping.mockResolvedValue('down');
      mockPrismaService.$queryRaw.mockResolvedValue([1]);

      const result = await controller.getHealth();

      expect(result.redis).toBe('down');
    });

    it('should return redis status as down when ping throws', async () => {
      mockCacheService.ping.mockRejectedValue(new Error('Connection refused'));
      mockPrismaService.$queryRaw.mockResolvedValue([1]);

      const result = await controller.getHealth();

      expect(result.redis).toBe('down');
    });

    it('should return db status as down when query fails', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('DB connection failed'),
      );

      const result = await controller.getHealth();

      expect(result.db).toBe('down');
    });
  });
});
