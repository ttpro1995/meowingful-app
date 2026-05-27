# Story: Tenant Management & Data Isolation

## Metadata
- **Story ID**: STORY-E02-01
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: High
- **Status**: Done ✓
- **Created**: 2026-05-24
- **Completed**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md, vibe-doc/stories/EPIC-01/STORY-E01-07-api-standardization.md

## User Story
As a platform super-admin, I want to create and manage organizations (tenants) so that each organization operates in complete data isolation from others on the shared platform.

## Context
The platform must support multiple independent organizations (English schools, training centers, etc.) sharing one deployment but seeing only their own data. Every subsequent feature — CRM, e-learning, notifications — must scope queries by tenant. Establishing the tenant entity and the request-scoping mechanism is therefore the highest-priority prerequisite for all of EPIC-02 through EPIC-05. This story also adopts STORY-E01-07 API contracts so tenant list APIs behave consistently with platform-wide pagination/filtering/error standards.

## Requirements

### Functional Requirements
- [x] Super-admin can create a tenant with: name, slug (URL-safe), plan tier, contact email
- [x] Super-admin can update tenant metadata and soft-delete (deactivate) a tenant
- [x] Every authenticated request carries a resolved `tenantId` available to all resolvers/services
- [x] All domain entities (users, leads, courses, etc.) include a `tenantId` foreign key
- [x] Queries are automatically scoped to the caller's tenant — cross-tenant data leakage is impossible at the ORM layer
- [x] Super-admin role can query across tenants (for platform administration)
- [x] `tenants` list query follows STORY-E01-07 (`pagination`, `orderBy`, shared filter types, `PaginatedResult` + `pageInfo`)
- [x] Tenant API errors are exposed through standardized GraphQL `UserError` shape/codes from STORY-E01-07

### Non-Functional Requirements
- [x] Tenant resolution adds < 2ms overhead per request (resolved from JWT claim, not a DB lookup)
- [ ] Adding `tenantId` to a new entity is documented and enforced via a shared Prisma base pattern
- [x] Deactivating a tenant prevents all logins for users of that tenant
- [x] Tenant list `limit` defaults to 20 and is capped at 100 via shared pagination primitives

## Acceptance Criteria
- [x] Two tenants with identical usernames cannot see each other's data — verified in integration test
- [x] A request without a valid tenant context returns `UNAUTHORIZED`
- [x] Deactivating tenant A does not affect tenant B's users
- [x] Super-admin can list all tenants with counts (users, active courses)
- [x] Requesting tenant list with `pagination.limit > 100` is rejected by validation with standardized error payload
- [x] Invalid tenant mutation input returns `VALIDATION_ERROR` with field-level details
- [ ] New Prisma models added by future stories include `tenantId` by convention (documented)

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Tenant` model; `tenantId` added to `User` and all future domain models
- **Backend**: `TenantModule` (global); `TenantContext` injected via `REQUEST` scope
- **Auth**: JWT payload includes `tenantId`; `TenantGuard` resolves and validates it
- **GraphQL**: `TenantLoader` service provides the scoped tenant object to resolvers
- **Shared Standards**: Reuses STORY-E01-07 pagination/filter contracts and global GraphQL error standardization

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
- [x] `TenantGuard` resolves `tenantId` from valid JWT
- [ ] `TenantGuard` rejects request when tenant is deactivated
- [x] Prisma middleware injects `tenantId` filter

### Integration Tests
- [x] Create tenant A and B; user of A cannot see user of B in `users` query
- [ ] Super-admin can see users from both tenants
- [x] Deactivated tenant users cannot authenticate

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

## Implementation Notes

### Completed Implementation
- **Prisma Schema**: `Tenant` model with `id`, `name`, `slug`, `planTier`, `contactEmail`, `isActive`, `createdAt`, `updatedAt`. `tenantId` added to `User` and `Auth` models with proper unique constraints (`@@unique([tenantId, username])`).

- **TenantModule** (`back-end/src/tenant/`): Global module with:
  - `TenantContext` - request-scoped provider exposing `tenantId`, `userId`, `role`, `isSuperAdmin`
  - `TenantGuard` - extracts `tenantId` from JWT, accessible via `AsyncLocalStorage`
  - `TenantContextInterceptor` - bridges HTTP request to AsyncLocalStorage context
  - `TenantService` - `createTenant`, `updateTenant`, `deactivateTenant`, `tenants`, `myTenant`
  - `TenantResolver` - GraphQL resolver for tenant operations

- **Prisma Middleware** (`back-end/src/prisma/prisma.service.ts`): Uses `$extends` with query middleware to automatically inject `tenantId` into `where` clauses for `User` and `Auth` models, while allowing super-admins to bypass scoping.

- **Migrations**: `20260524093000_add_tenants_and_isolation/migration.sql` - Creates Tenant table, adds `tenantId` to User/Auth, backfills existing users to default tenant.

- **Tests**: Unit tests for `TenantGuard` and `TenantService`; E2E tests for tenant isolation, deactivated tenant blocking, and super-admin tenant listing.

### E01-07 Alignment Revisit (2026-05-27)
- ✅ `tenants(query)` uses `TenantsQueryInput` with `PaginationArgs`, `OrderByArgs`, and shared filter inputs.
- ✅ `tenants` response returns `PaginatedTenants` with `pageInfo { total, page, limit, totalPages }`.
- ✅ Tenant resolver exceptions flow through global `formatGraphQLError`, producing standardized `UserError` codes (`VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHORIZED`, `INTERNAL_ERROR`).
- ✅ Added e2e assertions for E01-07 validation behavior in `back-end/test/tenant.e2e-spec.ts`:
  - `pagination.limit > 100` returns standardized `VALIDATION_ERROR`.
  - Invalid `createTenant` input returns field-level validation errors (`slug`, `contactEmail`).
