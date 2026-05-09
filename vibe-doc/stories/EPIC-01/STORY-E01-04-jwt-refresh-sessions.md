# Story: JWT Refresh Tokens & Session Management

## Metadata
- **Story ID**: STORY-E01-04
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/stories/EPIC-01/STORY-E01-02-redis-integration.md

## User Story
As a user, I want my session to stay alive without re-logging in every hour, and I want logging out to immediately invalidate my access so that my account is secure even if a token is leaked.

## Context
The current MVP issues a single long-lived JWT with no refresh mechanism. There is no way to revoke a token — logging out only removes it from `localStorage`. This is a security gap that must be closed before the platform adds sensitive data (CRM leads, student records). The fix is an access/refresh token pair backed by Redis for revocation.

## Requirements

### Functional Requirements
- [ ] Login returns a short-lived **access token** (15 min) and a long-lived **refresh token** (7 days)
- [ ] Refresh token is stored as an HTTP-only cookie (not accessible to JavaScript)
- [ ] A `refreshToken` GraphQL mutation exchanges a valid refresh token for new token pair
- [ ] Logout mutation deletes the refresh token from Redis (immediate revocation)
- [ ] Refresh token ID (jti claim) is stored in Redis with TTL = 7 days
- [ ] Reusing a revoked or expired refresh token returns `401 Unauthorized`

### Non-Functional Requirements
- [ ] Access token payload: `{ sub: userId, tenantId, jti, iat, exp }`
- [ ] Refresh token never appears in response body — only set as `HttpOnly; Secure; SameSite=Strict` cookie
- [ ] Redis key pattern: `refresh_token:<jti>`

## Acceptance Criteria
- [ ] After login, browser has a `refreshToken` HttpOnly cookie and the response body contains `accessToken`
- [ ] After access token expiry, `refreshToken` mutation returns a new access token without re-login
- [ ] After logout, calling `refreshToken` mutation returns `401`
- [ ] Redis shows the token entry with TTL via `TTL refresh_token:<jti>` command

## Technical Specifications

### Architecture Impact
- **Backend AuthService**: Split `login()` into access + refresh token generation
- **Backend AuthResolver**: Add `refreshToken` and update `logout` mutations
- **Backend**: Cookie middleware enabled in NestJS (`cookie-parser`)
- **Redis**: `CacheService.set('refresh_token:<jti>', userId, 604800)`
- **Frontend**: Apollo Client adds refresh logic via error link on 401 responses

### Token Flow
```
Login:
  POST /graphql { login } →
    Set-Cookie: refreshToken=<jwt>; HttpOnly; Secure
    Response: { accessToken: <jwt> }

Refresh:
  POST /graphql { refreshToken } (cookie sent automatically) →
    Validates cookie JWT → checks Redis jti → issues new pair

Logout:
  POST /graphql { logout } →
    Del Redis key → Clear cookie
```

### GraphQL Schema Changes
```graphql
type AuthPayload {
  accessToken: String!
  user: User!
}

type Mutation {
  login(username: String!, password: String!): AuthPayload!
  logout: Boolean!
  refreshToken: AuthPayload!   # NEW — uses HttpOnly cookie
}
```

### Data Structures
**Redis key**: `refresh_token:<jti>` → value: `userId`, TTL: 604800s

## Implementation Plan

### Step 1: Token Generation
- Install `uuid` for jti generation
- Create `generateTokenPair(userId)` in `AuthService` — returns `{ accessToken, refreshTokenJwt, jti }`
- Store `jti → userId` in Redis with 7-day TTL

### Step 2: Cookie Middleware
- Install `cookie-parser`
- Add `app.use(cookieParser())` in `main.ts`
- Enable `credentials: true` on CORS config

### Step 3: Refresh & Logout Mutations
- `refreshToken`: extract cookie → verify JWT → check Redis jti → issue new pair → rotate cookie
- `logout`: verify access token → del Redis jti → clear cookie

### Step 4: Frontend Refresh Logic
- Add Apollo Client `onError` link: on `UNAUTHENTICATED`, call `refreshToken` mutation, retry original query
- Update `AuthContext` to use `accessToken` from response body only

## Testing Strategy

### Unit Tests
- [ ] `generateTokenPair` returns correct structure and stores jti in Redis
- [ ] `refreshToken` returns 401 for revoked jti
- [ ] `logout` deletes jti from Redis

### Integration Tests
- [ ] Full login → wait (mock expiry) → refresh → use new token flow
- [ ] Login → logout → refresh returns 401

## Dependencies

### Blocked By
- STORY-E01-02 (Redis must be set up first)

### Blocks
- STORY-E01-06 (2FA integrates with login flow)
- EPIC-02 (RBAC tokens carry tenant and role claims)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cookie not sent in GraphQL requests | Medium | Ensure Apollo `credentials: 'include'` and CORS `allowedOrigins` are set correctly |
| Refresh token rotation race condition | Low | Implement token family invalidation if multiple refreshes detected |
