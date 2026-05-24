# Story: RBAC Roles & Permissions Framework

## Metadata
- **Story ID**: STORY-E02-02
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform administrator, I want a role-based access control system so that I can control which users can perform which actions within a tenant, with roles like Admin, Sales Manager, and Staff having appropriately scoped permissions.

## Context
The MVP has no roles beyond authenticated/unauthenticated. As CRM (EPIC-03) and E-Learning (EPIC-05) modules are added, each will need role guards (e.g., only "Sales Manager" can configure pipeline stages, only "Instructor" can create courses). This story establishes the RBAC framework before those modules are built to avoid retrofitting guards later.

## Requirements

### Functional Requirements
- [ ] Predefined roles: `SUPER_ADMIN`, `TENANT_ADMIN`, `DEVELOPER`, `DIRECTOR`, `SALES_MANAGER`, `STAFF`, `ACCOUNTANT`, `HR`, `INSTRUCTOR`, `STUDENT`
- [ ] Each role has a default set of permissions (seeded); permissions can be customized per tenant
- [ ] Permission check decorator `@RequirePermission('lead:create')` usable on any resolver/controller
- [ ] Tenant admin can view the permissions matrix for all roles in their tenant
- [ ] Tenant admin can grant/revoke individual permissions per role (within their tenant)
- [ ] Permission changes take effect immediately (no cache TTL > 0 for permission lookups)

### Non-Functional Requirements
- [ ] Permission check resolves in < 5ms — permissions cached in Redis per `tenantId:userId` with 60s TTL
- [ ] Permission denial returns `FORBIDDEN` error with the missing permission code (not a vague 403)
- [ ] All permission codes follow the pattern `resource:action` (e.g., `lead:create`, `course:publish`)

## Acceptance Criteria
- [ ] A `STAFF` user cannot call a mutation protected by `@RequirePermission('lead:delete')` — returns `FORBIDDEN`
- [ ] A `SALES_MANAGER` granted `lead:delete` can call that mutation
- [ ] Removing a permission from a role is reflected within 60 seconds (cache TTL)
- [ ] Integration test asserts that the correct role has the correct default permissions after seed

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Role`, `Permission`, `RolePermission` models
- **Backend**: `RbacModule` (global); `PermissionGuard`; `@RequirePermission()` decorator
- **Redis**: Permission cache per `perm:{tenantId}:{userId}` key, TTL 60s

### Prisma Schema
```prisma
model Role {
  id          String           @id @default(uuid())
  tenantId    String
  name        RoleName
  tenant      Tenant           @relation(fields: [tenantId], references: [id])
  permissions RolePermission[]
  userRoles   UserTenantRole[]
  @@unique([tenantId, name])
}

model Permission {
  id          String           @id @default(uuid())
  code        String           @unique  // e.g. "lead:create"
  description String
  rolePerms   RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id])
  permission   Permission @relation(fields: [permissionId], references: [id])
  @@id([roleId, permissionId])
}

enum RoleName {
  SUPER_ADMIN TENANT_ADMIN DEVELOPER DIRECTOR
  SALES_MANAGER STAFF ACCOUNTANT HR INSTRUCTOR STUDENT
}
```

### Permission Guard
```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 1. Read required permission from @RequirePermission() metadata
    // 2. Load user permissions from Redis cache (or DB + cache)
    // 3. Return false → throw ForbiddenException with permission code
  }
}
```

### Default Permission Seed (examples)
| Permission Code | TENANT_ADMIN | SALES_MANAGER | STAFF | INSTRUCTOR | STUDENT |
|----------------|:---:|:---:|:---:|:---:|:---:|
| `lead:create` | ✓ | ✓ | ✓ | | |
| `lead:delete` | ✓ | ✓ | | | |
| `course:create` | ✓ | | | ✓ | |
| `course:enroll` | ✓ | | | | ✓ |
| `tenant:manage` | ✓ | | | | |

## Implementation Plan

### Step 1: Prisma Models & Seed
- Create `Role`, `Permission`, `RolePermission` models
- Write seed: create default permissions + assign to default roles for every tenant on creation

### Step 2: RbacModule
- `RbacModule` provides `PermissionService` (loads + caches permissions)
- `PermissionGuard` implements `CanActivate`
- `@RequirePermission(...codes)` decorator sets metadata on resolver/controller method

### Step 3: Tenant Admin API
- Query: `rolePermissions(roleName)` — list permissions for a role
- Mutation: `grantPermission(roleName, permissionCode)`, `revokePermission(roleName, permissionCode)`
- Both mutations invalidate Redis cache for affected users

### Step 4: Integration
- Apply `@RequirePermission()` to existing admin-only mutations (e.g., `createTenant`)

## Testing Strategy

### Unit Tests
- [ ] `PermissionGuard` allows access when permission is in cache
- [ ] `PermissionGuard` denies and throws `FORBIDDEN` with code when missing
- [ ] Cache invalidation is called after `revokePermission`

### Integration Tests
- [ ] User with `STAFF` role cannot call `SALES_MANAGER`-gated mutation
- [ ] Granting permission dynamically allows previously denied call
- [ ] Default permissions are correct after tenant creation seed

## Dependencies

### Blocked By
- STORY-E02-01 (tenant context required — roles are scoped to tenants)
- STORY-E01-02 (Redis cache for permissions)

### Blocks
- STORY-E02-03 (role assignment needs the Role model)
- STORY-E03-01 (lead:create guard)
- STORY-E05-01 (course:create guard)
- All story-level permission guards in EPIC-03, 04, 05

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Permission explosion (too many codes) | Medium | Group by resource; document naming convention |
| Cache stale after role change | Low | 60s TTL + explicit invalidation on mutation |
| Tenant admin grants themselves SUPER_ADMIN | High | `SUPER_ADMIN` role cannot be assigned via tenant API; only via platform seed |

---

### Progress Update (2026-05-24)

- ✅ **Prisma models** for RBAC (`Role`, `Permission`, `RolePermission`, `RoleName`) added and migrated.
- ✅ **RbacModule**, `PermissionService`, `PermissionGuard`, and `@RequirePermission` decorator implemented in backend.
- ✅ Integrated `RbacModule` into `AppModule`.
- ⚠️ **RBAC seed script** (`prisma/seed-rbac.ts`) written, but running it fails with `PrismaClientInitializationError` due to config/env issues. Main app and migrations work, but direct script execution does not pick up config.
- ⏳ Next: Fix/adapt seed script, then implement Tenant Admin API and integration/tests.

---

### Progress Update (continued, 2026-05-24)

- ✅ Tenant Admin API: Added GraphQL resolver for rolePermissions, grantPermission, revokePermission.
- ✅ Integrated RBAC permission checks (example: @RequirePermission('tenant:manage') on createTenant mutation).
- ✅ Types for Role, Permission, and matrix added.
- ⏳ RBAC seed script still needs fix for direct execution (PrismaClient config issue).
