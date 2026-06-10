# Work Log: STORY-E02-06 Audit Logging

## Date
2026-06-11

## Summary
Implemented STORY-E02-06 across the backend: append-only audit schema, async queue-based persistence, resolver-level auditable interception, login success/failure audit events, and admin audit query with filtering + pagination.

## What Was Implemented

### Prisma and Migration
- Updated `back-end/prisma/schema.prisma`:
  - Added `AuditAction` enum.
  - Added `AuditLog` model with:
    - `tenantId`, `actorId`, `actorEmail`, `action`, `resource`, `resourceId`, `diff`, `ipAddress`, `archivedAt`, `createdAt`.
    - Relation to `Tenant` and optional relation to `User` (`actorId`).
    - Indexes for query/filter use cases.
- Added migration:
  - `back-end/prisma/migrations/20260611093000_story_e02_06_audit_logging/migration.sql`

### Audit Module
- Added new module and files under `back-end/src/audit/`:
  - `audit.module.ts`
  - `audit.service.ts`
  - `audit.resolver.ts`
  - `audit.interceptor.ts`
  - `audit.decorators.ts`
  - `audit.helpers.ts`
  - `audit.types.ts`
  - `audit.constants.ts`
  - `audit.interceptor.spec.ts`
- Implemented:
  - `@Auditable(resource)` decorator
  - `@AuditAction(resolver)` decorator for action/resourceId/diff extraction
  - Global interceptor that captures decorated resolver executions
  - BullMQ-backed async queue + worker (`audit-log`)
  - Query API: `auditLogs(query)` with filters (`actorId`, `resource`, `action`, `createdAt`) and pagination
  - Admin-only access (`TENANT_ADMIN` or `SUPER_ADMIN`)

### Auth and Mutation Integration
- Integrated login event auditing in `back-end/src/auth/auth.service.ts`:
  - `LOGIN_SUCCESS` on successful auth
  - `LOGIN_FAILED` on invalid user/password/membership paths
- Updated `back-end/src/auth/auth.resolver.ts` to pass request IP for login events.
- Added auditable decorators to mutation resolvers:
  - `back-end/src/auth/auth.resolver.ts`
  - `back-end/src/membership/membership.resolver.ts`
  - `back-end/src/tenant/tenant.resolver.ts`
  - `back-end/src/tenant/tenant-config.resolver.ts`
  - `back-end/src/rbac/rbac.resolver.ts`

### Safety and Reliability
- Added diff sanitization in `audit.helpers.ts` to strip sensitive keys like `password`, `passwordHash`, `token`, `refreshToken`, `accessToken`, `authorization`, and `cookie`.
- Added fail-safe behavior for not-yet-migrated environments:
  - If `AuditLog` table is missing (`P2021`), logging/query/archive paths warn and continue without breaking mutation responses.

## Test Coverage Added

### Unit
- `back-end/src/audit/audit.interceptor.spec.ts`
  - validates diff capture and audit payload emission
- Updated `back-end/src/auth/auth.service.spec.ts`
  - validates failed login emits `LOGIN_FAILED` event

### E2E
- Updated `back-end/test/auth.e2e-spec.ts` with audit scenarios:
  - audit row written after profile update
  - audit query filtered by actor/action/date range
  - failed login appears as `LOGIN_FAILED`
  - non-admin user gets `FORBIDDEN` on `auditLogs`

## Commands and Validation
- `npm install bullmq`
- `npx prisma generate`
- `npm run build` (PASS)
- `npm run test -- src/audit/audit.interceptor.spec.ts src/auth/auth.service.spec.ts` (PASS)
- `npx prisma migrate deploy` (applied new audit migration)
- `npx prisma migrate reset --force` (clean state for e2e)
- `npx jest --config ./test/jest-e2e.json --runInBand --verbose test/auth.e2e-spec.ts` (PASS)

## Notes
- Story checklist was updated to `In Progress`:
  - Core implementation and key tests are complete.
  - Remaining unchecked items are related to full "all mutations" coverage and explicit `FORBIDDEN` behavior for hypothetical audit mutations, plus operational scheduling for automatic archive execution.
