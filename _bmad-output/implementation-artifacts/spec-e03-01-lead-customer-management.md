---
title: 'Lead & Customer Management'
type: 'feature'
created: '2026-09-13'
status: 'in-review'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: []
deferred: []
baseline_revision: 'a62de01a9adb50eb2195fcd3afb1bb670fb3ae8c'
---

<intent-contract>

## Intent

**Problem:** Sales teams lack a central CRM record for every prospect from first contact through close. Without a lead/customer entity, the pipeline, task management, workflow automation, and analytics modules have nothing to build on.

**Approach:** Introduce `Lead`, `Customer`, and `LeadNote` Prisma models with tenant scoping and RBAC guards, then expose CRUD GraphQL resolvers with filtering and pagination.

## Boundaries & Constraints

**Always:** tenant-scoped queries enforced at ORM layer; `@RequirePermission` guards on every mutation; default pagination limit 20, max 100; `@RequireFeature('crm')` on the module.

**Block If:** schema naming conflicts with existing models; pagination pattern diverges from E01-07.

**Never:** cross-tenant data access; delete without explicit `lead:delete` permission; hardcoded tenantId values.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create lead | STAFF user, valid input | Lead created with caller tenantId, status NEW | Validation error for bad input |
| List leads filtered | `status: QUALIFIED` | Only qualified leads for caller tenant | Empty array if none |
| Convert lead | Lead status != CONVERTED | Customer created, lead marked CONVERTED | Error if already CONVERTED |
| Assign lead | Valid tenant member userId | `assignedToId` updated | FORBIDDEN if assignee belongs to different tenant |
| Delete lead | User with `lead:delete` | Lead deleted | FORBIDDEN without permission |
| Cross-tenant read | Tenant B user queries leads | Tenant A leads not visible | Returns only tenant B leads |

</intent-contract>

## Code Map

- `back-end/prisma/schema.prisma:28-186` -- Existing Tenant/User/Auth models, tenant scoping via `tenantId`, enum patterns
- `back-end/src/tenant/tenant.resolver.ts:1-89` -- Resolver pattern with `@RequirePermission`, `@Auditable`, `@AuditAction`
- `back-end/src/tenant/tenant.module.ts:1-45` -- Module wiring with `APP_GUARD` for TenantGuard and FeatureGuard
- `back-end/src/rbac/permission.guard.ts:13-25` -- `@RequirePermission` decorator definition
- `back-end/src/tenant/feature.guard.ts:16-19` -- `@RequireFeature` decorator definition
- `back-end/src/shared/pagination/paginate.ts:24-37` -- `paginate()` returns `{page, limit, skip, take}`
- `back-end/src/shared/pagination/paginated-result.type.ts` -- `PaginatedResult` helper for payload types
- `back-end/src/audit/audit.decorators.ts:1-12` -- `@Auditable` and `@AuditAction` decorators
- `back-end/src/audit/audit.interceptor.ts:1-126` -- `AuditInterceptor` enqueues events to BullMQ
- `back-end/src/prisma/prisma.service.ts` -- PrismaService singleton
- `back-end/src/app.module.ts:29` -- `autoSchemaFile` code-first generation path
- `back-end/prisma/seed-rbac.ts:36-76` -- Seed script pattern for permissions/roles
- `back-end/src/tenant/tenant.service.ts:48-78` -- Service pattern: PrismaService injection, `getTenantContext()`, Prisma queries
- `back-end/src/tenant/tenant.types.ts:1-185` -- GraphQL type/input definitions with class-validator
- `vibe-doc/stories/EPIC-03/STORY-E03-01-lead-customer-management.md` -- Source story requirements and acceptance criteria

## Tasks & Acceptance

**Execution:**
- `back-end/prisma/schema.prisma` -- Add Lead, Customer, LeadNote models and LeadStatus enum with tenant scoping, composite indexes, and `score` field
- `back-end/prisma/seed.ts` -- Add sample leads for dev environment
- `back-end/src/crm/crm.module.ts` -- Create CrmModule with `@RequireFeature('crm')`, import RbacModule, register TenantGuard and FeatureGuard
- `back-end/src/crm/crm.types.ts` -- Define Lead, Customer, LeadNote ObjectTypes; LeadsFilter, LeadsQueryInput InputTypes; LeadsPayload
- `back-end/src/crm/crm.service.ts` -- Implement lead CRUD, conversion, assignment, notes with tenant scoping and permission checks
- `back-end/src/crm/crm.resolver.ts` -- Wire queries/mutations with `@RequirePermission`, `@Auditable`, `@AuditAction` decorators
- `back-end/src/crm/crm.service.spec.ts` -- Unit tests for conversion and filtering logic
- `back-end/src/crm/crm.resolver.spec.ts` -- Integration tests for tenant isolation and permission enforcement

**Acceptance Criteria:**
- Given a STAFF user, when creating a lead, then the lead is created with the caller's tenantId and default status NEW
- Given a user with `lead:delete` permission, when calling `deleteLead`, then the lead is deleted; without the permission, FORBIDDEN is returned
- Given a lead with status QUALIFIED, when listing with filter `status: QUALIFIED`, then only qualified leads for the caller's tenant are returned
- Given a CONVERTIBLE lead, when calling `convertLeadToCustomer`, then a Customer record is created, the lead status becomes CONVERTED, and the conversion is auditable
- Given a timeline note added by user A on a lead, when user B views the same lead, then the note is visible in the timeline
- Given a lead owned by tenant A, when a user from tenant B queries leads, then the lead is not visible

## Spec Change Log

## Review Triage Log

### Pass: 2026-09-13
- **Blind Hunter:** 14 findings — 9 patch (tenant scoping, validation gaps, schema relations, seed typing), 5 defer (pre-existing duplication, global guard pattern, API design)
- **Edge Case Hunter:** 10 findings — 8 patch (FK violations, tenant validation, transaction race, date filter edge, error messaging), 2 defer (copy-paste utilities, onDelete defaults)
- **Verification Gap:** 3 findings — 3 patch (DEFAULT_ROLE_PERMISSIONS verification, FeatureGuard inference, resolver test depth)
- **Intent Alignment:** 5 findings — 3 patch (integration tests, cross-tenant explicit test, permission denial test, pagination metadata edge), 2 reject (feature flag already globally applied, permission gating design choice)

**Outcome:** No intent_gap or bad_spec findings. Applied 20 patches directly. Set followup_review_recommended: true.

## Design Notes

- Follow the tenant.service.ts pattern: inject PrismaService, call `getTenantContext()` for tenantId, use Prisma include for relations.
- Reuse `paginate()` from `shared/pagination/paginate.ts` and `PaginatedResult` from `shared/pagination/paginated-result.type.ts` for list responses.
- Use `class-validator` decorators on input types matching tenant.types.ts style.
- The `Lead` model stores `assignedToId` referencing `User.id`; assignment mutation must validate the target user belongs to the same tenant before writing.
- `LeadsFilter` should reuse `EnumFilter` for `status`, `StringFilter` for `source`, `DateFilter` for `from`/`to` date range, and a plain `StringFilter`-style field for `assignedToId`.
- Include `score` (Int, nullable 1-5) on `Lead`; conversion and assignment mutations must enforce tenant scoping through `getTenantContext()`.

## Verification

**Commands:**
- `cd back-end && npx prisma generate && npx prisma migrate dev --name add-lead-customer` -- expected: migration applies cleanly, schema.gql updates
- `cd back-end && npm run test -- --testPathPattern=crm` -- expected: all crm specs pass
- `cd back-end && npm run lint` -- expected: zero lint errors
