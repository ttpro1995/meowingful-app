# 2026-05-31: CI Prisma Migration Fix (TenantConfig updatedAt)

## Summary
- Fixed backend CI regression where `npx prisma migrate deploy` failed with `P3018` during migration `20260528090000_story_e02_04_tenant_config`.

## Root Cause
- `TenantConfig.updatedAt` is defined as `NOT NULL` in SQL.
- Backfill SQL inserted only `id` and `tenantId`, so `updatedAt` became `NULL` and violated the constraint on fresh databases.

## Changes Made
- Updated migration file:
  - `back-end/prisma/migrations/20260528090000_story_e02_04_tenant_config/migration.sql`
- SQL change:
  - Before:
    - `INSERT INTO "TenantConfig" ("id", "tenantId") ...`
  - After:
    - `INSERT INTO "TenantConfig" ("id", "tenantId", "updatedAt") ... CURRENT_TIMESTAMP`

## Why This Fix
- CI runs migrations on clean databases.
- Ensuring backfill rows set `updatedAt` removes the not-null failure while preserving existing behavior and defaults for other fields.

## Verification
- Local command attempted:
  - `cd back-end && DATABASE_URL='postgresql://test:test@localhost:5432/test_db?schema=public' npx prisma migrate deploy`
- Result in this environment:
  - Could not fully validate because local Postgres was not running (`P1001: Can't reach database server at localhost:5432`).
- Expected CI outcome:
  - Migration `20260528090000_story_e02_04_tenant_config` should now apply without `updatedAt` constraint errors.
