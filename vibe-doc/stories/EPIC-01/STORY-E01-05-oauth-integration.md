# Story: OAuth Integration (Google Login)

## Metadata
- **Story ID**: STORY-E01-05
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/stories/EPIC-01/STORY-E01-04-jwt-refresh-sessions.md

## User Story
As a user, I want to sign in with my Google account so that I don't need to create and remember a separate password.

## Context
Password-based login is already implemented. Adding OAuth allows faster onboarding (no registration form) and delegates credential security to a trusted identity provider. Google OAuth is the first provider; the implementation should be extensible to GitHub, Microsoft, etc.

## Requirements

### Functional Requirements
- [ ] "Sign in with Google" button on the login page initiates OAuth 2.0 authorization code flow
- [ ] On callback, backend exchanges code for Google profile and creates or retrieves a user
- [ ] OAuth users are created without a password entry in the `Auth` table — they have a separate `OAuthAccount` record
- [ ] Returning OAuth user who already has an account is logged in (no duplicate account creation)
- [ ] After successful OAuth login, user receives the same access/refresh token pair as password login
- [ ] OAuth users can link additional providers from their profile settings

### Non-Functional Requirements
- [ ] Google OAuth credentials (client ID, secret) stored as environment variables only
- [ ] Callback URL validated against whitelist (prevent open redirect)
- [ ] Standard `passport-google-oauth20` strategy used via `@nestjs/passport`

## Acceptance Criteria
- [ ] Clicking "Sign in with Google" redirects to Google consent screen
- [ ] After consent, user is redirected to the app and is logged in (access token set, cookie set)
- [ ] A user who signs in with Google for the first time gets a new `User` record created
- [ ] A second sign-in with the same Google account logs into the existing user — no duplicate
- [ ] Integration test confirms the OAuth callback handler creates/retrieves the user correctly

## Technical Specifications

### Architecture Impact
- **Backend**: New `OAuthModule` with `PassportModule`, `GoogleStrategy`
- **Backend**: New REST endpoint `GET /auth/google` and `GET /auth/google/callback`
- **Database**: New `OAuthAccount` table
- **Frontend**: "Sign in with Google" button opens popup or redirects to `/auth/google`

### Database Schema Addition
```prisma
model OAuthAccount {
  id           String   @id @default(uuid())
  userId       String
  provider     String   // "google", "github", etc.
  providerId   String   // Google sub
  email        String?
  user         User     @relation(fields: [userId], references: [id])

  @@unique([provider, providerId])
}
```

### OAuth Flow
```
Frontend → GET /auth/google
  → Google consent screen
  → GET /auth/google/callback?code=xxx
  → Backend: exchange code → get profile → findOrCreate user
  → Set refresh token cookie → redirect to frontend with accessToken in query param
  → Frontend: store accessToken, clear param from URL
```

### Environment Variables
```
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3500/auth/google/callback
```

## Implementation Plan

### Step 1: Database Migration
- Add `OAuthAccount` model to Prisma schema
- Run migration

### Step 2: Backend OAuth Strategy
- Install `passport`, `@nestjs/passport`, `passport-google-oauth20`
- Create `GoogleStrategy` extending `PassportStrategy`
- Implement `validate()`: find existing `OAuthAccount` or create User + OAuthAccount
- Create `OAuthController` with `/auth/google` and `/auth/google/callback` routes

### Step 3: Token Issuance on OAuth Callback
- After `validate()` returns user, call `AuthService.generateTokenPair(userId)`
- Set refresh token cookie
- Redirect to frontend with access token as short-lived query param

### Step 4: Frontend Integration
- Add "Sign in with Google" button on login page
- On redirect back, extract `accessToken` from URL, store in memory, clear from URL
- Update `AuthContext` to handle OAuth login alongside password login

## Testing Strategy

### Unit Tests
- [ ] `GoogleStrategy.validate()` creates a new user when OAuth account not found
- [ ] `GoogleStrategy.validate()` returns existing user when OAuth account found

### Integration Tests
- [ ] Mock Google callback with a fake profile; assert user created and tokens returned
- [ ] Call callback twice with same Google sub; assert only one user exists

### Manual Testing
- [ ] Full flow: click Google button → consent → redirected back as logged-in user

## Dependencies

### Blocked By
- STORY-E01-04 (token pair generation must exist)

### Blocks
- EPIC-02 (SSO can be extended to tenant-specific OAuth providers)

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Access token exposed in URL briefly | Low | Immediately replace with session; URL param is short-lived and cleared |
| Account merge conflicts (same email, different provider) | Medium | Match on email + prompt user to link accounts |
