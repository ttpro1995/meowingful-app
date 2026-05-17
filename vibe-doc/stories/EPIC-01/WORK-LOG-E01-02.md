# Work Log: STORY-E01-02 Redis Integration

## 2026-05-17

### Step 1: Docker Compose & Environment
- [x] Add Redis service to both compose files (docker-compose.yml, docker-compose.dev.yml)
- [x] Add `REDIS_*` env vars to `.env` and created `.env.example`

### Step 2: NestJS Redis Module
- [x] Install `ioredis` package
- [x] Create `RedisModule` (global) with connection factory using env vars
- [x] Create `CacheService` with `set`, `get`, `del`, `exists` methods
- [x] Add Redis health indicator to existing health check endpoint

### Step 3: Tests
- [x] Added unit tests for `CacheService` methods with mocked Redis client
- [x] Added unit tests for `HealthController` with `redis` field in response

### Step 4: Integration Tests
- [x] Created `redis.e2e-spec.ts` with Redis `set/get/del` tests
- [x] Added integration test that verifies Redis health check response

## Files Created
- `back-end/src/redis/redis.module.ts` - Global Redis module with connection factory
- `back-end/src/redis/redis.constants.ts` - Redis client token constant
- `back-end/src/redis/cache.service.ts` - Cache service with set/get/del/exists methods
- `back-end/src/redis/cache.service.spec.ts` - Unit tests for CacheService
- `back-end/test/redis.e2e-spec.ts` - Integration tests for Redis

## Files Modified
- `docker-compose.yml` - Added Redis service with persistence (AOF)
- `docker-compose.dev.yml` - Added Redis service for development
- `back-end/.env` - Added REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- `.env.example` - Created template for environment variables
- `back-end/src/app.module.ts` - Imported RedisModule
- `back-end/src/health/health.controller.ts` - Added Redis status to health check
- `back-end/src/health/health.module.ts` - Imported RedisModule
- `back-end/src/health/health.controller.spec.ts` - Updated tests for Redis status