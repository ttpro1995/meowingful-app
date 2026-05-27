# Story: User-Tenant Membership & Role Assignment

## Metadata
- **Story ID**: STORY-E02-03
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: High
- **Status**: Ready for Review
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md, vibe-doc/stories/EPIC-01/STORY-E01-07-api-standardization.md

## User Story
As a tenant admin, I want to invite users into my organization and assign them roles so that each team member has the appropriate level of access.

## Context
Currently every user belongs to exactly one tenant (set at registration). In practice, a consultant or instructor may work across multiple tenants. This story introduces the many-to-many `UserTenantRole` join that properly models membership, enables invitation-based onboarding, and wires roles to users so the RBAC framework (E02-02) can resolve permissions. Membership list and error contracts should follow STORY-E01-07 so tenant admin UX remains consistent with other modules.

## Requirements

### Functional Requirements
- [x] Tenant admin can invite a user by email; invitation is sent (email via STORY-E04-01) and expires in 72h
- [x] Invited user accepts/declines via a token link
- [x] Tenant admin assigns one or more roles to a member from the predefined role list
- [x] Tenant admin can update a member's role or remove them from the tenant
- [x] A user can belong to multiple tenants; they select the active tenant at login or switch post-login
- [x] Removing a user from a tenant revokes all their permissions in that tenant immediately
- [x] `members` query follows STORY-E01-07 contract (`pagination`, `orderBy`, shared filters, paginated payload)

### Non-Functional Requirements
- [x] Invitation token is a signed JWT (short-lived, not stored in DB except as hash for revocation)
- [x] Role changes take effect within the Redis cache TTL (60s, see E02-02)
- [x] Pagination on member list follows STORY-E01-07 standard
- [x] Membership API errors are exposed via standardized GraphQL `UserError` extensions from STORY-E01-07

## Acceptance Criteria
- [x] Admin invites user@example.com; user receives an email with an accept link
- [x] Accepting the invitation with an expired token returns a clear error
- [x] Admin assigns `SALES_MANAGER` role; user can immediately use sales-gated endpoints (within 60s)
- [x] Admin removes a user; their next request returns `UNAUTHORIZED`
- [x] User who belongs to tenant A and tenant B can switch context without re-authenticating
- [x] Invalid membership query/mutation input returns standardized `VALIDATION_ERROR` details

## Technical Specifications

### Architecture Impact
- **Prisma**: New `UserTenantRole` join table; `Invitation` model
- **Backend**: `MembershipModule`; `InvitationService`; tenant-switch mutation
- **Auth**: JWT `tenantId` claim updated on tenant switch (new short-lived JWT issued)
- **Shared Standards**: Reuses STORY-E01-07 pagination/filter primitives and global GraphQL error formatting

### Prisma Schema
```prisma
model UserTenantRole {
  userId   String
  tenantId String
  roleId   String
  user     User   @relation(fields: [userId], references: [id])
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  role     Role   @relation(fields: [roleId], references: [id])
  @@id([userId, tenantId, roleId])
}

model Invitation {
  id         String   @id @default(uuid())
  tenantId   String
  email      String
  roleId     String
  tokenHash  String   @unique
  expiresAt  DateTime
  acceptedAt DateTime?
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
}
```

### Tenant-Switch Flow
```
mutation switchTenant(tenantId: ID!): AuthPayload
```
- Validates user is a member of the target tenant
- Issues a new access token with `tenantId` updated
- Client replaces stored JWT

## Implementation Plan

### Step 1: Prisma Migration
- Add `UserTenantRole` and `Invitation` models
- Migrate existing `User.tenantId` to `UserTenantRole` rows (backfill as TENANT_ADMIN)

### Step 2: Invitation Flow
- `inviteMember(email, roleId)` mutation → create `Invitation` record + send email
- `acceptInvitation(token)` mutation → validate token hash, create `UserTenantRole`, mark invitation accepted
- `declineInvitation(token)` mutation → mark invitation declined

### Step 3: Membership Management API
- Queries: `members(pagination)` — list tenant members with their roles
- Mutations: `updateMemberRoles(userId, roleIds)`, `removeMember(userId)`
- On role change: invalidate Redis permission cache for that user

### Step 4: Tenant Switch
- `switchTenant(tenantId)` mutation — validate membership, return new JWT
- Frontend: tenant switcher UI component (dropdown in nav)

## Testing Strategy

### Unit Tests
- [x] Invitation token hash is generated and stored correctly
- [x] Expired invitation token returns `INVITATION_EXPIRED` error
- [x] `removeMember` invalidates Redis cache for that user

### Integration Tests
- [x] Full invitation flow: invite → accept → user can switch into invited tenant context
- [x] Removed user's next API call returns `UNAUTHORIZED`
- [x] Tenant switch returns JWT with updated `tenantId` claim

---

### Progress Update (2026-05-26)

- ✅ Prisma updated for multi-role membership and invitations:
  - `UserTenantRole` now supports multiple roles per user/tenant via composite key.
  - `Invitation` model added with hashed token storage, expiry, and accepted/declined timestamps.
  - Migration added at `back-end/prisma/migrations/20260526103000_story_e02_03_membership_and_invitation`.
- ✅ New backend `MembershipModule` implemented:
  - `inviteMember`, `acceptInvitation`, `declineInvitation`
  - `members` query with STORY-E01-07 style page/limit pagination, `orderBy`, and filter inputs (legacy cursor args retained as deprecated compatibility fields)
  - `updateMemberRoles` (multi-role assignment) and `removeMember`
  - `myTenants` query for tenant membership listing
- ✅ Auth flow extended with `switchTenant(tenantId)` mutation:
  - Validates membership in target tenant.
  - Issues a fresh JWT/session for the selected tenant context.
- ✅ RBAC permission loading now resolves from `UserTenantRole` assignments (with legacy fallback), and cache invalidation covers membership-based users.
- ✅ Tests added/updated:
  - New unit tests for invitation hashing, expired invitation handling, and cache invalidation.
  - Existing unit/e2e suites updated for new tenant-role relations and cleanup dependencies.

### Progress Update (2026-05-26, Completion Pass)

- ✅ Backend hardening for revocation and cross-tenant membership:
  - `TenantGuard` now validates token tenant membership on protected GraphQL operations.
  - Auth session flow no longer auto-recreates memberships during login/refresh.
  - `PrismaService` user tenant scoping updated to support membership-aware access (not only legacy `User.tenantId`).
- ✅ Added RBAC visibility query for current context:
  - `myPermissions` query exposes resolved permissions for active tenant context, enabling end-to-end verification of role changes.
- ✅ New integration suite:
  - Added `back-end/test/membership.e2e-spec.ts` covering invite → accept → switch tenant, JWT tenant claim update, role update permission propagation, and immediate `UNAUTHORIZED` after member removal.
  - Updated related e2e fixtures (`tenant.e2e-spec.ts`, `rbac.e2e-spec.ts`) to include explicit `UserTenantRole` memberships required by stricter auth enforcement.
- ✅ Frontend story scope completed:
  - Added tenant switcher UX in profile with `myTenants` + `switchTenant` wiring.
  - Added invitation response page (`/invite`) with accept/decline actions and login redirect flow for token links.
  - Added/updated frontend unit tests for tenant switching and invitation handling.

### E01-07 Alignment Revisit (2026-05-27)
- ✅ `members` endpoint uses shared `PaginationArgs`, `OrderByArgs`, and filter types, returning paginated metadata (`pageInfo`).
- ✅ Membership flows now inherit standardized GraphQL `UserError` formatting (`VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHORIZED`, `INTERNAL_ERROR`).
- ✅ Added e2e assertions in `back-end/test/membership.e2e-spec.ts` to verify standardized validation responses for:
  - invalid `members` pagination input (`pagination.limit > 100`),
  - invalid `inviteMember` input (email/roleId).
- ⚠️ `myTenants` remains a direct per-user list (non-paginated). Keep as-is for now due bounded per-user scope; migrate to paginated contract if tenant memberships grow materially.

### Remaining for Story Completion

- None for current story scope. Optional future enhancement: tenant selection directly at login (current implementation supports post-login switching).

## Dependencies

### Blocked By
- STORY-E02-01 (tenant entity)
- STORY-E02-02 (Role model, permission cache invalidation)
- STORY-E04-01 (invitation email — can be stubbed initially with console log)

### Blocks
- STORY-E02-05 (admin dashboard needs member counts)
- STORY-E03-01 (lead assignment to team members)
- STORY-E05-03 (student enrollment uses membership model)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Invitation email not delivered | Medium | Resend invitation mutation; show pending invite status in UI |
| User accepts invitation after being removed | Low | Check `Invitation.acceptedAt` and tenant active status on accept |
| Multi-tenant JWT confusion | Medium | Tenant switch always issues a fresh JWT; client must replace stored token |
