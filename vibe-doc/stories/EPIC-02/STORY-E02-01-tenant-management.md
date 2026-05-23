# Story: Tenant Management & Data Isolation

## Metadata
- **Story ID**: STORY-E02-01
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform super-admin, I want to create and manage organizations (tenants) so that each organization operates in complete data isolation from others on the shared platform.

## Context
The platform must support multiple independent organizations (English schools, training centers, etc.) sharing one deployment but seeing only their own data. Every subsequent feature — CRM, e-learning, notifications — must scope queries by tenant. Establishing the tenant entity and the request-scoping mechanism is therefore the highest-priority prerequisite for all of EPIC-02 through EPIC-05.

## Requirements

### Functional Requirements
- [ ] Super-admin can create a tenant with: name, slug (URL-safe), plan tier, contact email
- [ ] Super-admin can update tenant metadata and soft-delete (deactivate) a tenant
- [ ] Every authenticated request carries a resolved `tenantId` available to all resolvers/services
- [ ] All domain entities (users, leads, courses, etc.) include a `tenantId` foreign key
- [ ] Queries are automatically scoped to the caller's tenant — cross-tenant data leakage is impossible at the ORM layer
- [ ] Super-admin role can query across tenants (for platform administration)

### Non-Functional Requirements
- [ ] Tenant resolution adds < 2ms overhead per request (resolved from JWT claim, not a DB lookup)
- [ ] Adding `tenantId` to a new entity is documented and enforced via a shared Prisma base pattern
- [ ] Deactivating a tenant prevents all logins for users of that tenant

## Acceptance Criteria
- [ ] Two tenants with identical usernames cannot see each other's data — verified in integration test
- [ ] A request without a valid tenant context returns `UNAUTHORIZED`
- [ ] Deactivating tenant A does not affect tenant B's users
- [ ] Super-admin can list all tenants with counts (users, active courses)
- [ ] New Prisma models added by future stories include `tenantId` by convention (documented)

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Tenant` model; `tenantId` added to `User` and all future domain models
- **Backend**: `TenantModule` (global); `TenantContext` injected via `REQUEST` scope
- **Auth**: JWT payload includes `tenantId`; `TenantGuard` resolves and validates it
- **GraphQL**: `TenantLoader` service provides the scoped tenant object to resolvers

### Prisma Schema
```prisma
model Tenant {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  planTier    String   @default("basic")
  contactEmail String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       User[]
}

model User {
  // existing fields ...
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
}
```

### Tenant Context Service
```typescript
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  tenantId: string;
  isSuperAdmin: boolean;
}
```

### Super-Admin Identification
- Super-admins are identified by a separate `role: SUPER_ADMIN` claim in the JWT
- Super-admin accounts are seeded via migration, not created through the tenant UI

## Implementation Plan

### Step 1: Prisma Migration
- Add `Tenant` model and `tenantId` to `User`
- Write and apply migration; update seed script to create a default tenant

### Step 2: TenantModule & Context
- Create `TenantModule` (global) with `TenantContext` (request-scoped)
- `TenantGuard` reads `tenantId` from JWT, validates tenant is active, populates `TenantContext`
- Register `TenantGuard` globally (after `JwtAuthGuard`)

### Step 3: Tenant GraphQL API
- Mutations: `createTenant`, `updateTenant`, `deactivateTenant` (super-admin only)
- Queries: `tenants` (paginated, super-admin), `myTenant` (current tenant metadata)

### Step 4: Data Isolation Enforcement
- Add Prisma middleware that automatically appends `where: { tenantId }` to all non-super-admin queries
- Write integration test: create two tenants, assert user of tenant A cannot query tenant B data

## Testing Strategy

### Unit Tests
- [ ] `TenantGuard` resolves `tenantId` from valid JWT
- [ ] `TenantGuard` rejects request when tenant is deactivated
- [ ] Prisma middleware injects `tenantId` filter

### Integration Tests
- [ ] Create tenant A and B; user of A cannot see user of B in `users` query
- [ ] Super-admin can see users from both tenants
- [ ] Deactivated tenant users cannot authenticate

## Dependencies

### Blocked By
- STORY-E01-04 (JWT infrastructure already in place — JWT claims extended to include `tenantId`)

### Blocks
- STORY-E02-02, STORY-E02-03, STORY-E02-04, STORY-E02-05, STORY-E02-06
- STORY-E03-01 and all EPIC-03 stories
- STORY-E04-01 and all EPIC-04 stories
- STORY-E05-01 and all EPIC-05 stories

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Forgot to add `tenantId` to a new model | High | Prisma middleware throws if a whitelisted model lacks `tenantId` field |
| Super-admin JWT exposed | High | Super-admin accounts have no tenant UI; API is separate admin-only endpoint |
| Migration breaks existing users | Medium | Backfill existing users to a "default" tenant in the migration script |
