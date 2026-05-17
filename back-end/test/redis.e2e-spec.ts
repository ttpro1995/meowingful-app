import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CacheService } from './../src/redis/cache.service';

describe('Redis Integration (e2e)', () => {
  let app: INestApplication<App>;
  let cacheService: CacheService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    cacheService = moduleFixture.get<CacheService>(CacheService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/health (GET)', () => {
    it('should return health status with redis field', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('redis');
      expect(response.body.redis).toBe('ok');
    });
  });

  describe('CacheService', () => {
    const testKey = 'test-cache-key';
    const testValue = 'test-value';

    afterEach(async () => {
      await cacheService.del(testKey);
    });

    it('should set and get a value', async () => {
      await cacheService.set(testKey, testValue, 60);
      const result = await cacheService.get(testKey);

      expect(result).toBe(testValue);
    });

    it('should check if key exists', async () => {
      await cacheService.set(testKey, testValue, 60);
      const exists = await cacheService.exists(testKey);

      expect(exists).toBe(true);
    });

    it('should delete a key', async () => {
      await cacheService.set(testKey, testValue, 60);
      await cacheService.del(testKey);
      const value = await cacheService.get(testKey);

      expect(value).toBeNull();
    });

    it('should return false for non-existing key', async () => {
      const exists = await cacheService.exists('non-existent-key');

      expect(exists).toBe(false);
    });
  });
});