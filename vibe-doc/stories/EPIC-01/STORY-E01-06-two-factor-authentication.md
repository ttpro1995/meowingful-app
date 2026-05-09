# Story: Two-Factor Authentication (TOTP)

## Metadata
- **Story ID**: STORY-E01-06
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/stories/EPIC-01/STORY-E01-04-jwt-refresh-sessions.md

## User Story
As a security-conscious user, I want to enable two-factor authentication on my account so that a stolen password alone cannot grant access.

## Context
The platform will store CRM data (leads, customer contacts) and student personal information. Admin and sales manager roles are particularly high-value targets. TOTP-based 2FA (Google Authenticator / Authy compatible) is the industry standard for this threat model.

## Requirements

### Functional Requirements
- [ ] User can enable 2FA from account settings — shown a QR code to scan with authenticator app
- [ ] After enabling, user must confirm by entering a valid TOTP code before 2FA is activated
- [ ] On login, if 2FA is enabled, backend returns a `REQUIRES_2FA` status instead of tokens
- [ ] User submits TOTP code to complete login and receive tokens
- [ ] User can disable 2FA by entering a valid TOTP code or a backup code
- [ ] 10 single-use backup codes are generated at 2FA setup and displayed once

### Non-Functional Requirements
- [ ] TOTP secret stored encrypted in the database (AES-256)
- [ ] Pending 2FA state (after password verified, awaiting TOTP) stored in Redis with 5-minute TTL
- [ ] TOTP verification uses time-window tolerance of ±1 step (30s drift allowed)

## Acceptance Criteria
- [ ] User enables 2FA: QR code renders in settings, confirming with TOTP code activates it
- [ ] Login with 2FA-enabled account: password login returns `{ status: "REQUIRES_2FA", tempToken: "..." }`
- [ ] Submitting valid TOTP code with `tempToken` returns full access/refresh token pair
- [ ] Submitting wrong TOTP code returns `401` without consuming a backup code
- [ ] Using a backup code works and marks that code as used (cannot reuse)

## Technical Specifications

### Architecture Impact
- **Backend**: New `TwoFactorModule`; updates to `AuthService.login()`
- **Database**: New fields on `Auth` table; new `BackupCode` table
- **Redis**: Pending 2FA sessions stored with 5-minute TTL

### Database Schema Changes
```prisma
model Auth {
  // ... existing fields
  twoFactorEnabled    Boolean  @default(false)
  twoFactorSecret     String?  // AES-256 encrypted
}

model BackupCode {
  id        String   @id @default(uuid())
  userId    String
  codeHash  String   // bcrypt hashed
  used      Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id])
}
```

### Redis Key (pending 2FA)
`2fa_pending:<tempToken>` → `userId`, TTL: 300s

### Login Flow with 2FA
```
1. POST login(username, password) →
   If 2FA disabled: return { accessToken, user }   (existing flow)
   If 2FA enabled:
     → Generate tempToken (UUID) → store in Redis 5 min
     → Return { status: "REQUIRES_2FA", tempToken }

2. POST verify2fa(tempToken, code) →
   → Look up userId from Redis
   → Verify TOTP code against decrypted secret
   → Del Redis key → return { accessToken, user }
```

### GraphQL Schema Changes
```graphql
type LoginResult {
  status: LoginStatus!
  accessToken: String         # null if REQUIRES_2FA
  tempToken: String           # set if REQUIRES_2FA
  user: User                  # null if REQUIRES_2FA
}

enum LoginStatus { OK REQUIRES_2FA }

type Mutation {
  setup2FA: TwoFactorSetup!               # returns otpAuthUrl + backupCodes
  confirm2FA(code: String!): Boolean!     # activates 2FA
  disable2FA(code: String!): Boolean!
  verify2FA(tempToken: String!, code: String!): AuthPayload!
}

type TwoFactorSetup {
  otpAuthUrl: String!     # for QR code
  backupCodes: [String!]! # shown once only
}
```

## Implementation Plan

### Step 1: TOTP Library & Encryption
- Install `otplib` for TOTP generation/verification
- Add AES-256 encryption utility for secret storage (use `APP_SECRET` env var as key)

### Step 2: 2FA Setup Flow
- `setup2FA`: generate TOTP secret with `otplib`, encrypt and store temporarily in Redis, return `otpAuthUrl`
- `confirm2FA`: verify submitted code, persist encrypted secret to DB, generate and store 10 bcrypt-hashed backup codes

### Step 3: Login Flow Update
- Update `AuthService.login()`: check `twoFactorEnabled` → if true, issue `tempToken` to Redis
- New `verify2FA` mutation: validates TOTP or backup code, issues token pair

### Step 4: Frontend UI
- Settings page: "Enable 2FA" shows QR code (use `qrcode.react`), confirm step, backup codes display
- Login page: conditional second step renders TOTP input when `status === "REQUIRES_2FA"`

## Testing Strategy

### Unit Tests
- [ ] TOTP verification with valid/invalid codes and time drift
- [ ] Backup code hash verification and used-code rejection
- [ ] `login()` returns correct shape based on `twoFactorEnabled`

### Integration Tests
- [ ] Full enable flow: setup → confirm → login → verify2FA
- [ ] Backup code usage: login → submit backup code → code marked used

## Dependencies

### Blocked By
- STORY-E01-02 (Redis for pending 2FA sessions)
- STORY-E01-04 (token pair generation)

### Blocks
- EPIC-02 (admin accounts will require 2FA)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| User loses authenticator app with no backup codes | High | Display backup codes prominently; offer recovery via admin |
| Clock drift on server causes valid codes to fail | Low | Allow ±1 window tolerance in `otplib` config |
