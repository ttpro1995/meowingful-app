# Story: WebSocket Real-Time Infrastructure

## Metadata
- **Story ID**: STORY-E04-02
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform user, I want updates to appear on screen instantly — new notifications, dashboard metric changes, live chat messages — without refreshing the page so that the platform feels responsive and alive.

## Context
WebSocket connections are needed by three distinct features: pushing in-app notifications in real-time (E04-01), admin dashboard live metrics (E02-05), and future live class chat (EPIC-06). This story builds the shared WebSocket gateway so those consumers don't each build their own connection management. Socket.io is preferred over raw WS because it handles reconnection, rooms, and namespace separation.

## Requirements

### Functional Requirements
- [ ] NestJS WebSocket gateway using Socket.io
- [ ] Authenticated connections only — JWT verified on handshake; unauthenticated connections are rejected
- [ ] Users are placed into tenant-scoped rooms automatically on connect (`room: tenant:{tenantId}`) and user-specific rooms (`room: user:{userId}`)
- [ ] Server can emit events to: a single user, all users of a tenant, or a specific room
- [ ] Client receives `notification.new` events pushed from `NotificationService` (E04-01)
- [ ] Connection state visible in health check: active WebSocket connection count

### Non-Functional Requirements
- [ ] Tested stable under 1,000 concurrent connections (load test)
- [ ] Redis pub/sub adapter (`socket.io-redis`) used so multiple backend instances share connection state
- [ ] Heartbeat/ping every 25s to detect stale connections; clean up on disconnect

## Acceptance Criteria
- [ ] After login, client establishes a WebSocket connection; disconnecting and reconnecting re-joins rooms automatically
- [ ] Sending a `LEAD_ASSIGNED` notification via `NotificationService` pushes a `notification.new` event to the user's WebSocket within 500ms
- [ ] Unauthenticated WebSocket connection attempt is rejected with an auth error
- [ ] `/health` endpoint includes `{ websocket: { connections: N } }`

## Technical Specifications

### Architecture Impact
- **Backend**: `WebSocketModule` (global); `AppGateway` (Socket.io); Redis adapter for horizontal scaling
- **Redis**: `socket.io-redis` adapter — all instances share room/socket state via Redis pub/sub
- **Frontend**: WebSocket hook (`useWebSocket`) with auto-reconnect; event listener registration

### NestJS Gateway
```typescript
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    // 1. Verify JWT from handshake auth headers
    // 2. Join tenant room: `tenant:{tenantId}`
    // 3. Join user room: `user:{userId}`
    // 4. Increment connection counter in Redis
  }

  async handleDisconnect(client: Socket) {
    // Decrement connection counter in Redis
  }
}
```

### WebSocketService (emit helper)
```typescript
@Injectable()
export class WebSocketService {
  emitToUser(userId: string, event: string, data: unknown): void
  emitToTenant(tenantId: string, event: string, data: unknown): void
  emitToRoom(room: string, event: string, data: unknown): void
}
```

### Redis Adapter Setup
```typescript
// In WebSocketModule
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();
app.useWebSocketAdapter(redisIoAdapter);
```

### Events Published
| Event | Payload | Audience |
|-------|---------|----------|
| `notification.new` | `{ notification }` | User room |
| `dashboard.updated` | `{ metrics }` | Tenant room |
| `task.updated` | `{ task }` | User room |

## Implementation Plan

### Step 1: WebSocket Gateway & Auth
- Install `@nestjs/websockets`, `socket.io`, `socket.io-redis`
- Create `AppGateway` with JWT verification on handshake
- Room join logic on `handleConnection`

### Step 2: WebSocketService
- `emitToUser`, `emitToTenant`, `emitToRoom` helper methods
- Register as global provider

### Step 3: Redis Adapter
- Wire `RedisIoAdapter` using existing Redis config from E01-02
- Test with two backend instances sharing state

### Step 4: Integration with Notification Engine
- In `NotificationService.send`: after saving in-app notification, call `WebSocketService.emitToUser(userId, 'notification.new', notification)`

### Step 5: Frontend Hook
- `useWebSocket()` hook: connects on login, reconnects on disconnect, exposes `on(event, handler)` and `off(event)`
- Toast notification displayed when `notification.new` received

### Step 6: Load Test
- Artillery or k6 test: 1,000 concurrent clients connect, server emits to all, verify all receive within 1s

## Testing Strategy

### Unit Tests
- [ ] `handleConnection` rejects socket with invalid JWT
- [ ] `emitToUser` calls `server.to(userRoom).emit(event, data)`

### Integration Tests
- [ ] Client connects, receives `notification.new` within 500ms after `NotificationService.send`
- [ ] Disconnected client cleans up from room (no zombie sockets)
- [ ] Two backend instances with Redis adapter: emit on instance A reaches client on instance B

## Dependencies

### Blocked By
- STORY-E01-02 (Redis — used for Socket.io adapter)
- STORY-E02-01 (tenant context — room naming uses `tenantId`)

### Blocks
- STORY-E02-05 (admin dashboard real-time subscriptions)
- STORY-E04-05 (internal messaging over WebSocket)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Socket.io CORS in production | Medium | Configure `origin` from env var `ALLOWED_ORIGINS` |
| Redis adapter not available in test env | Low | Use in-memory adapter in test; Redis adapter only in prod/staging |
| Connection spike on reconnect after outage | Medium | Exponential backoff in frontend hook (1s, 2s, 4s, max 30s) |
