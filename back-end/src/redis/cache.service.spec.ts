import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: {
    status: string;
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      status: 'ready',
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
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

  describe('onModuleDestroy', () => {
    it.each([
      ['get', () => service.get('test-key')],
      ['del', () => service.del('test-key')],
      ['exists', () => service.exists('test-key')],
      ['ping', () => service.ping()],
    ])(
      'should wait for a pending %s operation before disconnecting',
      async (_, startOperation) => {
        let resolveOperation!: (value: never) => void;
        const pendingOperation = new Promise<never>((resolve) => {
          resolveOperation = resolve;
        });
        const redisMethod = mockRedis[_ as 'get' | 'del' | 'exists' | 'ping'];
        redisMethod.mockReturnValue(pendingOperation);
        mockRedis.status = 'wait';

        const operation = startOperation();
        const destroyOperation = service.onModuleDestroy();

        expect(mockRedis.disconnect).not.toHaveBeenCalled();

        resolveOperation(undefined as never);
        await operation;
        await destroyOperation;

        expect(mockRedis.disconnect).toHaveBeenCalledWith(false);
      },
    );

    it('should wait for pending cache operations before disconnecting', async () => {
      let resolveSet!: () => void;
      const pendingSet = new Promise<void>((resolve) => {
        resolveSet = resolve;
      });
      mockRedis.status = 'wait';
      mockRedis.set.mockReturnValue(pendingSet);

      const setOperation = service.set('test-key', 'test-value', 60);
      const destroyOperation = service.onModuleDestroy();

      expect(mockRedis.disconnect).not.toHaveBeenCalled();

      resolveSet();
      await setOperation;
      await destroyOperation;

      expect(mockRedis.disconnect).toHaveBeenCalledWith(false);
    });

    it('should complete teardown when a pending cache operation rejects', async () => {
      let rejectSet!: (error: Error) => void;
      const pendingSet = new Promise<void>((_, reject) => {
        rejectSet = reject;
      });
      const cacheError = new Error('Redis error');
      mockRedis.set.mockReturnValue(pendingSet);

      const setOperation = service.set('test-key', 'test-value', 60);
      const destroyOperation = service.onModuleDestroy();

      rejectSet(cacheError);

      await expect(setOperation).rejects.toBe(cacheError);
      await expect(destroyOperation).resolves.toBeUndefined();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should drain an operation tracked while shutdown is waiting', async () => {
      let resolveSet!: (value: string) => void;
      let resolveGet!: (value: string) => void;
      const pendingSet = new Promise<string>((resolve) => {
        resolveSet = resolve;
      });
      const pendingGet = new Promise<string>((resolve) => {
        resolveGet = resolve;
      });
      mockRedis.status = 'wait';
      mockRedis.set.mockReturnValue(pendingSet);
      mockRedis.get.mockReturnValue(pendingGet);

      const setOperation = service.set('test-key', 'test-value', 60);
      void pendingSet.finally(() => service.get('test-key'));
      const destroyOperation = service.onModuleDestroy();

      resolveSet('OK');
      await setOperation;
      await Promise.resolve();

      expect(mockRedis.disconnect).not.toHaveBeenCalled();

      resolveGet('test-value');
      await destroyOperation;

      expect(mockRedis.disconnect).toHaveBeenCalledWith(false);
    });

    it('should disconnect without pending operations in wait state', async () => {
      mockRedis.status = 'wait';

      await service.onModuleDestroy();

      expect(mockRedis.disconnect).toHaveBeenCalledWith(false);
    });
  });
});
