import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  describe('set', () => {
    it('should set a key with value and TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('test-key', 'test-value', 60);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        'test-value',
        'EX',
        60,
      );
    });

    it('should throw error when redis fails', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.set('test-key', 'test-value', 60)).rejects.toThrow(
        'Redis error',
      );
    });
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockRedis.get.mockResolvedValue('test-value');

      const result = await service.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existing key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return PONG on successful ping', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.ping();

      expect(result).toBe('PONG');
    });

    it('should return down on ping failure', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.ping();

      expect(result).toBe('down');
    });
  });
});
