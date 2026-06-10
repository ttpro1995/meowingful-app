# Work Log - 2026-05-28 - STORY-E02-04 Tenant Configuration

## Summary
Implemented STORY-E02-04 across backend and frontend:
- Added tenant-level configuration model and migration.
- Added cached tenant config query/mutations and super-admin feature toggles.
- Added feature gating infrastructure with `@RequireFeature()` and global feature guard.
- Added logo upload endpoint with S3-compatible storage service and local fallback.
- Added frontend tenant branding/nav logo rendering and admin tenant configuration form.

## Backend Changes

### Prisma
- Updated `back-end/prisma/schema.prisma`:
  - Added `TenantConfig` model.
  - Added one-to-one relation from `Tenant` to `TenantConfig`.
- Added migration:
  - `back-end/prisma/migrations/20260528090000_story_e02_04_tenant_config/migration.sql`
  - Creates `TenantConfig` table + backfills one config row per existing tenant.

### Tenant Config + Feature Guard
- Added `back-end/src/tenant/tenant-config.types.ts`.
- Added `back-end/src/tenant/tenant-config.service.ts`.
- Added `back-end/src/tenant/tenant-config.resolver.ts`.
- Added `back-end/src/tenant/feature.guard.ts`:
  - New `@RequireFeature()` decorator.
  - Global guard checks tenant config feature flags from Redis cache.
  - Maps `lead:*` permission metadata to `crm` feature enforcement.

### Logo Upload + Storage
- Added `back-end/src/file-storage/file-storage.module.ts`.
- Added `back-end/src/file-storage/file-storage.service.ts`:
  - S3-compatible upload via AWS SDK.
  - Local fallback storage with URL serving.
- Added `back-end/src/tenant/tenant-logo-auth.guard.ts`.
- Added `back-end/src/tenant/tenant-logo.controller.ts`:
  - `POST /api/v1/tenant/logo` (multipart, image-only, 2MB max).
  - `GET /api/v1/tenant/logo/:tenantId/:fileName` for local fallback serving.

### Existing Backend File Updates
- Updated `back-end/src/tenant/tenant.module.ts` to register new resolver/service/controller/guards.
- Updated `back-end/src/tenant/tenant.service.ts`:
  - Creates default tenant config during tenant creation.
  - `myTenant` now returns `logoUrl` from config.
- Updated `back-end/src/tenant/tenant.types.ts` to expose optional `logoUrl`.

### Backend Tests
- Added `back-end/src/tenant/feature.guard.spec.ts`.
- Added `back-end/src/tenant/tenant-config.service.spec.ts`.
- Updated `back-end/src/tenant/tenant.service.spec.ts` for `myTenant` config include.

## Frontend Changes
- Updated `front-end/src/graphql/queries.ts`:
  - Added `MY_TENANT`, `TENANT_CONFIG`, `UPDATE_TENANT_CONFIG`.
- Updated `front-end/src/pages/Profile.tsx`:
  - Tenant branding/nav logo rendering from `myTenant`.
  - Tenant config admin form (primaryColor, subdomain, timezone, defaultLanguage, businessHours).
  - Logo upload to REST endpoint.
- Updated `front-end/src/App.css` with tenant nav/config styles.
- Updated `front-end/src/pages/Profile.spec.tsx` to mock new `MY_TENANT` query.

## Dependencies
- Installed backend dependencies:
  - `@aws-sdk/client-s3` (runtime dependency)
  - `@types/multer` (dev dependency)

## Validation Run
- Backend:
  - `cd back-end && npx prisma generate`
  - `cd back-end && npm run build`
  - `cd back-end && npm test -- src/tenant/tenant-config.service.spec.ts src/tenant/feature.guard.spec.ts src/tenant/tenant.service.spec.ts`
  - `cd back-end && npx jest --config ./test/jest-e2e.json --runInBand test/tenant.e2e-spec.ts`
- Frontend:
  - `cd front-end && npm run test:run -- src/pages/Profile.spec.tsx`
  - `cd front-end && npm run build`

## Notes
- `createLead` integration acceptance checks are still blocked by absence of CRM lead mutations (expected in STORY-E03-01).
- Timezone impact on scheduled notifications remains part of STORY-E04-04.
