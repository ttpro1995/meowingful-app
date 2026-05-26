# Work Log - 2026-05-26 - STORY-E02-03 User-Tenant Membership

## Objective
Implement backend foundations for STORY-E02-03:
- user-tenant many-to-many membership
- invitation token flow
- role assignment updates
- tenant switching for multi-tenant users

## Completed

### 1) Prisma and migration
- Updated `back-end/prisma/schema.prisma`:
  - `UserTenantRole` changed to composite primary key `@@id([userId, tenantId, roleId])`
  - Added `Invitation` model (`tokenHash`, `expiresAt`, `acceptedAt`, `declinedAt`)
- Added migration:
  - `back-end/prisma/migrations/20260526103000_story_e02_03_membership_and_invitation/migration.sql`
- Ran `npx prisma generate`.
- Applied migrations locally with `npx prisma migrate deploy` for runtime validation.

### 2) Membership module implementation
- Added `back-end/src/membership/`:
  - `membership.module.ts`
  - `membership.types.ts`
  - `membership.service.ts`
  - `membership.resolver.ts`
- Implemented GraphQL operations:
  - `inviteMember(input)`
  - `acceptInvitation(input)`
  - `declineInvitation(input)`
  - `members(query)` with cursor pagination
  - `updateMemberRoles(input)` (supports multiple role IDs)
  - `removeMember(userId)`
  - `myTenants()`
- Invitation behavior:
  - signed JWT token (72h)
  - hash-only storage (`tokenHash`) in DB
  - email delivery stub via server log line

### 3) Auth + tenant switch
- Extended auth flow in:
  - `back-end/src/auth/auth.service.ts`
  - `back-end/src/auth/auth.resolver.ts`
- Added `switchTenant(tenantId)` mutation:
  - verifies membership in target tenant
  - issues fresh access + refresh session tied to target tenant context
- Added membership bootstrap in auth session/register/login paths to keep legacy users compatible.

### 4) RBAC permission resolution updates
- Updated:
  - `back-end/src/rbac/permission.service.ts`
  - `back-end/src/rbac/rbac.resolver.ts`
- Permission loading now resolves from `UserTenantRole` assignments first.
- Legacy `User.role` fallback retained for migration compatibility.
- Role-level cache invalidation now includes membership-based users.

### 5) Supporting updates
- Registered `MembershipModule` in `back-end/src/app.module.ts`.
- Updated tenant user counting in `back-end/src/tenant/tenant.service.ts` to use memberships.
- Updated e2e cleanup for FK-safe deletion order in `back-end/test/tenant.e2e-spec.ts`.

## Tests and validation

### Unit/lint
- `npm run lint -- --max-warnings 0` ✅
- `npm run test -- --runInBand` ✅

### E2E
- `npm run test:e2e -- --runInBand` ✅
- Notes:
  - During first run, encountered schema drift (`UserTenantRole.createdAt` missing) until migration was applied.
  - After migration and tenant e2e teardown update, full e2e suite passed.

## Story documentation updates
- Updated story file:
  - `vibe-doc/stories/EPIC-02/STORY-E02-03-user-tenant-membership.md`
- Marked completed checklist items for implemented backend scope.
- Added a dated progress section and remaining work section.

## Remaining scope
- Frontend tenant switcher UX and invitation acceptance UX path.
- Additional integration scenarios specific to invitation acceptance + post-removal authorization behavior.
