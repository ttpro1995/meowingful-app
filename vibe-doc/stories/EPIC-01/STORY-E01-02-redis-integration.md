# Story: Redis Integration

## Metadata
- **Story ID**: STORY-E01-02
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform engineer, I want Redis added to the infrastructure so that session tokens, short-lived caches, and future real-time pub/sub share a fast, shared store.

## Context
The current stack has no caching layer. JWT tokens are stateless and cannot be revoked without a token blacklist store. Future features (notifications, live class, rate limiting) all require a fast key-value store. Redis is the planned solution per the architecture doc.

## Requirements

### Functional Requirements
- [ ] Redis container added to `docker-compose.yml` and `docker-compose.dev.yml`
- [ ] NestJS backend connects to Redis via `@nestjs-modules/ioredis` or `ioredis` directly
- [ ] JWT refresh token IDs stored in Redis with TTL matching token expiry (enables revocation)
- [ ] A Redis health check is included in the backend `/health` endpoint response
- [ ] Cache service abstraction created for easy use by other modules

### Non-Functional Requirements
- [ ] Redis connection failure does not crash the backend — graceful degradation with warning log
- [ ] Redis password configured via environment variable (not hardcoded)
- [ ] Redis data is persisted with AOF or RDB in production docker-compose

## Acceptance Criteria
- [ ] `docker-compose up` starts Redis alongside backend and frontend
- [ ] Backend logs "Redis connected" on startup
- [ ] Logging out a user invalidates the stored refresh token ID in Redis (verified in integration test)
- [ ] Health endpoint returns Redis status: `{ "redis": "ok" }` or `{ "redis": "down" }`
- [ ] `CacheService.set(key, value, ttlSeconds)` and `CacheService.get(key)` work correctly

## Technical Specifications

### Architecture Impact
- **Infrastructure**: Add Redis 7 container to Docker Compose
- **Backend**: New `RedisModule` (global) wrapping ioredis; new `CacheService`
- **Auth**: Refresh token IDs persisted to Redis (see STORY-E01-04)

### Docker Compose Addition
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD}
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### CacheService Interface
```typescript
@Injectable()
export class CacheService {
  async set(key: string, value: string, ttlSeconds: number): Promise<void>
  async get(key: string): Promise<string | null>
  async del(key: string): Promise<void>
  async exists(key: string): Promise<boolean>
}
```

### Environment Variables
```
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=changeme
```

## Implementation Plan

### Step 1: Docker Compose & Environment
- Add Redis service to both compose files
- Add `REDIS_*` env vars to `.env.example`

### Step 2: NestJS Redis Module
- Install `ioredis` package
- Create `RedisModule` (global) with connection factory using env vars
- Create `CacheService` with `set`, `get`, `del`, `exists` methods
- Add Redis health indicator to existing health check endpoint

### Step 3: Integration Test
- Add integration test that sets and gets a cache value through `CacheService`
- Add integration test that verifies Redis health check response

## Testing Strategy

### Unit Tests
- [ ] `CacheService` methods with mocked Redis client

### Integration Tests
- [ ] Redis `set/get/del` against real Redis container
- [ ] Health check returns correct Redis status

## Dependencies

### Prerequisites
- Docker and Docker Compose installed (already met)

### Blocked By
- Nothing

### Blocks
- STORY-E01-04 (refresh tokens stored in Redis)
- STORY-E01-06 (2FA TOTP secrets cached in Redis temporarily)
- Future: rate limiting, notifications, pub/sub

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis OOM on small server | Low | Set `maxmemory` and `maxmemory-policy allkeys-lru` in Redis config |
| Connection instability | Medium | ioredis auto-reconnect enabled by default |
