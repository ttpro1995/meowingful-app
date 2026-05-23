# Story: User-Tenant Membership & Role Assignment

## Metadata
- **Story ID**: STORY-E02-03
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant admin, I want to invite users into my organization and assign them roles so that each team member has the appropriate level of access.

## Context
Currently every user belongs to exactly one tenant (set at registration). In practice, a consultant or instructor may work across multiple tenants. This story introduces the many-to-many `UserTenantRole` join that properly models membership, enables invitation-based onboarding, and wires roles to users so the RBAC framework (E02-02) can resolve permissions.

## Requirements

### Functional Requirements
- [ ] Tenant admin can invite a user by email; invitation is sent (email via STORY-E04-01) and expires in 72h
- [ ] Invited user accepts/declines via a token link
- [ ] Tenant admin assigns one or more roles to a member from the predefined role list
- [ ] Tenant admin can update a member's role or remove them from the tenant
- [ ] A user can belong to multiple tenants; they select the active tenant at login or switch post-login
- [ ] Removing a user from a tenant revokes all their permissions in that tenant immediately

### Non-Functional Requirements
- [ ] Invitation token is a signed JWT (short-lived, not stored in DB except as hash for revocation)
- [ ] Role changes take effect within the Redis cache TTL (60s, see E02-02)
- [ ] Pagination on member list follows STORY-E01-07 standard

## Acceptance Criteria
- [ ] Admin invites user@example.com; user receives an email with an accept link
- [ ] Accepting the invitation with an expired token returns a clear error
- [ ] Admin assigns `SALES_MANAGER` role; user can immediately use sales-gated endpoints (within 60s)
- [ ] Admin removes a user; their next request returns `UNAUTHORIZED`
- [ ] User who belongs to tenant A and tenant B can switch context without re-authenticating

## Technical Specifications

### Architecture Impact
- **Prisma**: New `UserTenantRole` join table; `Invitation` model
- **Backend**: `MembershipModule`; `InvitationService`; tenant-switch mutation
- **Auth**: JWT `tenantId` claim updated on tenant switch (new short-lived JWT issued)

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
- Mutations: `updateMemberRole(userId, roleId)`, `removeMember(userId)`
- On role change: invalidate Redis permission cache for that user

### Step 4: Tenant Switch
- `switchTenant(tenantId)` mutation — validate membership, return new JWT
- Frontend: tenant switcher UI component (dropdown in nav)

## Testing Strategy

### Unit Tests
- [ ] Invitation token hash is generated and stored correctly
- [ ] Expired invitation token returns `INVITATION_EXPIRED` error
- [ ] `removeMember` invalidates Redis cache for that user

### Integration Tests
- [ ] Full invitation flow: invite → accept → user can login in new tenant
- [ ] Removed user's next API call returns `UNAUTHORIZED`
- [ ] Tenant switch returns JWT with updated `tenantId` claim

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
