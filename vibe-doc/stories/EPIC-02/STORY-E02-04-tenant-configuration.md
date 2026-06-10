# Story: Tenant Configuration — Branding, Feature Flags & Settings

## Metadata
- **Story ID**: STORY-E02-04
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: Medium
- **Status**: Completed
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant admin, I want to customize my organization's branding and toggle platform features on or off so that the platform fits our school's identity and we only pay for what we use.

## Context
Different tenants have different needs — a small tutoring center may not need the call center module, while an enterprise school needs everything. Tenant-level feature flags prevent un-purchased modules from appearing in the UI and protect backend endpoints. Branding (logo, colors, domain) differentiates tenants visually without a separate deployment.

## Requirements

### Functional Requirements
- [x] Tenant admin can upload a logo and set a primary color for the tenant's UI theme
- [x] Tenant admin can set a custom subdomain (e.g., `myschool.meowingful.com`) — stored, not yet auto-provisioned
- [x] Platform super-admin can toggle feature flags per tenant: `crm`, `elearning`, `call_center`, `live_classes`, `marketplace`
- [x] Feature flags are checked at API level — disabled-module endpoints return `FEATURE_DISABLED` error
- [x] Tenant admin can configure general settings: timezone, default language, business hours

### Non-Functional Requirements
- [x] Tenant config is cached in Redis (TTL 5 min) — not fetched from DB on every request
- [x] Logo stored in object storage (S3-compatible); URL returned in tenant config
- [x] Feature flag check adds < 1ms overhead (from Redis cache)

## Acceptance Criteria
- [x] Tenant with `crm` flag disabled returns `FEATURE_DISABLED` on any `lead:*` mutation
- [x] Logo URL is returned in `myTenant` query and rendered in the frontend nav
- [x] Changing a feature flag takes effect within 5 minutes (cache TTL)
- [ ] Timezone setting is reflected in scheduled notification delivery (see STORY-E04-04)

## Technical Specifications

### Architecture Impact
- **Prisma**: New `TenantConfig` model (one-to-one with `Tenant`)
- **Backend**: `TenantConfigService`; `@RequireFeature('crm')` decorator; config cached in Redis
- **Storage**: MinIO (dev) / S3 (prod) for logo; `FileStorageModule` (foundation for STORY-E05-06)

### Prisma Schema
```prisma
model TenantConfig {
  id             String   @id @default(uuid())
  tenantId       String   @unique
  logoUrl        String?
  primaryColor   String   @default("#3B82F6")
  subdomain      String?
  timezone       String   @default("UTC")
  defaultLanguage String  @default("en")
  businessHours  Json?    // { mon: "09:00-18:00", ... }
  features       Json     @default("{\"crm\":false,\"elearning\":false,\"call_center\":false,\"live_classes\":false,\"marketplace\":false}")
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
}
```

### Feature Flag Decorator
```typescript
@RequireFeature('crm')  // applied at resolver level
// → reads TenantConfig.features from Redis cache
// → throws FeatureDisabledException if flag is false
```

## Implementation Plan

### Step 1: Prisma Migration
- Add `TenantConfig` with default values; create a config row for every tenant on creation

### Step 2: Config API
- Query: `tenantConfig` — returns current tenant's config (all fields)
- Mutation: `updateTenantConfig(input)` — tenant admin updates branding/settings; invalidates cache
- Mutation: `setFeatureFlag(tenantId, feature, enabled)` — super-admin only

### Step 3: Logo Upload
- REST endpoint `POST /tenant/logo` (multipart) → upload to S3/MinIO → update `logoUrl`
- Use `FileStorageModule` (foundation to be expanded in STORY-E05-06)

### Step 4: Feature Guard
- `@RequireFeature()` decorator + `FeatureGuard` using cached config

## Testing Strategy

### Unit Tests
- [x] `FeatureGuard` allows request when feature is enabled in cache
- [x] `FeatureGuard` throws `FEATURE_DISABLED` when flag is false
- [x] Cache is invalidated on `setFeatureFlag` mutation

### Integration Tests
- [ ] Tenant with `crm: false` cannot call `createLead` mutation
- [ ] Setting `crm: true` enables `createLead` within 5 minutes

---

### Progress Update (2026-05-28)

- ✅ Prisma and migration completed:
  - Added `TenantConfig` model with one-to-one `Tenant` relation, branding/settings fields, and JSON feature flags.
  - Added migration `back-end/prisma/migrations/20260528090000_story_e02_04_tenant_config` with tenant backfill.
- ✅ Backend tenant configuration API implemented:
  - Added `tenantConfig` query.
  - Added `updateTenantConfig(input)` mutation for tenant admins (`tenant:manage` capable users).
  - Added `setFeatureFlag(tenantId, feature, enabled)` mutation for super-admin only.
  - Added Redis caching (`tenant_config:{tenantId}`) with `TTL=300s` and explicit invalidation/reset on updates.
- ✅ Feature flag enforcement added:
  - Added `@RequireFeature()` decorator and global `FeatureGuard`.
  - Guard supports explicit feature metadata and maps `lead:*` permission metadata to `crm`.
  - Disabled features throw `FEATURE_DISABLED`.
- ✅ Logo upload foundation implemented:
  - Added `FileStorageModule` with S3-compatible storage support (`@aws-sdk/client-s3`) and local fallback.
  - Added REST endpoint `POST /api/v1/tenant/logo` (multipart, image-only, 2MB max) with tenant-admin auth.
  - Added local fallback logo retrieval route `GET /api/v1/tenant/logo/:tenantId/:fileName`.
- ✅ Frontend integration completed:
  - Added tenant branding nav rendering with `myTenant.logoUrl`.
  - Added tenant configuration form in Profile for admin-capable users (primary color, subdomain, timezone, language, business hours).
  - Added logo upload flow from Profile via REST endpoint.

### Verification (2026-05-28)

- ✅ Backend build:
  - `cd back-end && npm run build`
- ✅ Backend unit tests:
  - `cd back-end && npm test -- src/tenant/tenant-config.service.spec.ts src/tenant/feature.guard.spec.ts src/tenant/tenant.service.spec.ts`
- ✅ Backend tenant e2e regression:
  - `cd back-end && npx jest --config ./test/jest-e2e.json --runInBand test/tenant.e2e-spec.ts`
- ✅ Frontend tests and build:
  - `cd front-end && npm run test:run -- src/pages/Profile.spec.tsx`
  - `cd front-end && npm run build`

### Remaining Notes

- `createLead` integration assertions remain blocked until CRM lead mutations are available in STORY-E03-01.
- Timezone-driven scheduled notifications remain in STORY-E04-04 scope.

### Post-Completion Regression Fix (2026-05-31)

- CI `prisma migrate deploy` failed on fresh databases with `P3018` (`TenantConfig.updatedAt` not-null violation).
- Root cause: migration backfill inserted only `id` and `tenantId` into `TenantConfig` while `updatedAt` was required.
- Fix applied in `back-end/prisma/migrations/20260528090000_story_e02_04_tenant_config/migration.sql`:
  - Backfill now inserts `updatedAt = CURRENT_TIMESTAMP`.

## Dependencies

### Blocked By
- STORY-E02-01 (tenant entity)
- STORY-E01-02 (Redis for feature config cache)

### Blocks
- STORY-E03-01 (CRM features gated behind `crm` flag)
- STORY-E05-01 (E-learning features gated behind `elearning` flag)
- STORY-E04-04 (timezone used for scheduled notification delivery)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature flag cache stale after toggle | Low | 5-min TTL + explicit invalidation on update |
| Logo upload size | Low | Enforce 2MB limit at REST endpoint |
| Subdomain provisioning complexity | Medium | Store subdomain field now; auto-provisioning is out of scope for this story |
